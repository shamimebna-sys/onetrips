import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { applyPromoToBooking, commitPromoForBooking, releasePromoForBooking } from "./service";

function loadEnv() {
  try {
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const path = `${process.cwd()}/.env`;
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const hasDb = Boolean(process.env.DATABASE_URL);

async function seedBooking(suffix: string, userId: string, index: number) {
  return prisma.booking.create({
    data: {
      bookingRef: `OTP${suffix.toUpperCase().slice(0, 6)}${index}`,
      type: "FLIGHT",
      status: "PAYMENT_PENDING",
      userId,
      totalAmount: 11000,
      currency: "BDT",
      supplierCost: 10000,
      snapshot: {
        offer: {
          cabin: "ECONOMY",
          itineraries: [{ segments: [{ airlineCode: "BG", origin: "DAC", destination: "DXB" }] }],
          fare: {
            currency: "BDT",
            base: 10000,
            taxes: 1000,
            total: 11000,
            supplierBase: 10000,
            supplierTaxes: 1000,
          },
        },
      },
    },
  });
}

describe.skipIf(!hasDb)("promotion reservation lifecycle", () => {
  it("enforces usage limits under concurrent apply and commits/releases statuses", async () => {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
    const promo = await prisma.promotion.create({
      data: {
        code: `SAVE${suffix.slice(0, 6).toUpperCase()}`,
        name: "Concurrent cap",
        status: "ACTIVE",
        currency: "BDT",
        percentOff: 10,
        usageLimit: 1,
        perCustomerLimit: 1,
        flightEligible: true,
        hotelEligible: true,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });
    const users = await Promise.all(
      [0, 1].map((i) =>
        prisma.user.create({
          data: {
            email: `promo.${suffix}.${i}@onetrips.test`,
            passwordHash: "x",
            displayName: `Promo ${i}`,
            type: "CUSTOMER",
            status: "ACTIVE",
          },
        }),
      ),
    );
    const bookings = await Promise.all(users.map((user, i) => seedBooking(suffix, user.id, i)));

    const results = await Promise.allSettled(
      bookings.map((booking, i) => applyPromoToBooking(booking.id, users[i].id, { code: promo.code })),
    );
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedError).toBeInstanceOf(DomainError);

    const reserved = await prisma.promotionRedemption.findMany({ where: { promotionId: promo.id } });
    expect(reserved).toHaveLength(1);
    expect(reserved[0].status).toBe("RESERVED");

    await commitPromoForBooking(reserved[0].bookingId);
    const committed = await prisma.promotionRedemption.findUniqueOrThrow({ where: { id: reserved[0].id } });
    expect(committed.status).toBe("COMMITTED");

    await releasePromoForBooking(committed.bookingId);
    const released = await prisma.promotionRedemption.findUniqueOrThrow({ where: { id: reserved[0].id } });
    expect(released.status).toBe("RELEASED");
  });
});
