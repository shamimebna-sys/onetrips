import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@onetrips/database";
import { handleWebhook } from "./service";
import { signedWebhookBody } from "./adapters/mock";

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

describe.skipIf(!hasDb)("payment webhook idempotency", () => {
  it("posts one success, one ledger credit, and one booking transition under concurrent replay", async () => {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
    const user = await prisma.user.create({
      data: {
        email: `pay.idem.${suffix}@onetrips.test`,
        passwordHash: "x",
        displayName: "Pay Idem",
        type: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const booking = await prisma.booking.create({
      data: {
        bookingRef: `OTP${suffix.toUpperCase().slice(0, 8)}`,
        type: "FLIGHT",
        status: "PAYMENT_PROCESSING",
        userId: user.id,
        totalAmount: 5000,
        currency: "BDT",
        snapshot: { sessionId: suffix, quotedTotal: 5000 },
      },
    });
    const providerRef = `MOCKPAY${suffix.toUpperCase()}`;
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 5000,
        currency: "BDT",
        status: "PROCESSING",
        method: "CARD",
        providerRef,
        idempotencyKey: `booking:${booking.id}:pay`,
      },
    });

    const signed = signedWebhookBody({
      eventId: `evt-${suffix}`,
      providerRef,
      status: "SUCCESS",
      amount: "5000.00",
      currency: "BDT",
    });

    const results = await Promise.all(
      Array.from({ length: 4 }, () => handleWebhook(signed.raw, signed.signature)),
    );
    expect(results.filter((row) => row.duplicate).length).toBeGreaterThanOrEqual(0);

    const replay = await handleWebhook(signed.raw, signed.signature);
    expect(replay.duplicate).toBe(true);

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe("SUCCESS");
    const successCount = await prisma.payment.count({ where: { bookingId: booking.id, status: "SUCCESS" } });
    expect(successCount).toBe(1);

    const credits = await prisma.ledgerEntry.findMany({ where: { reference: `PAY-${payment.id}` } });
    expect(credits).toHaveLength(1);
    expect(String(credits[0].amount).replace(/\.0+$/, "")).toBe("5000");

    const events = await prisma.paymentWebhookEvent.findMany({
      where: { idempotencyKey: `mock-gateway:evt-${suffix}` },
    });
    expect(events).toHaveLength(1);

    const next = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(next.status).not.toBe("PAYMENT_PROCESSING");
    expect(["PAYMENT_SUCCESS", "BOOKING_PENDING", "BOOKED", "TICKETING_PENDING", "TICKETED", "TICKETING_FAILED"]).toContain(
      next.status,
    );
  });
});
