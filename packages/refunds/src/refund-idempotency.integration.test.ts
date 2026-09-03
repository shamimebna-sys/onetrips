import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@onetrips/database";
import { refundBooking } from "./service";

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

describe.skipIf(!hasDb)("refund idempotency", () => {
  it("creates one refund, one ledger reversal, and no duplicate wallet credit under concurrent submit", async () => {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
    const user = await prisma.user.create({
      data: {
        email: `rf.idem.${suffix}@onetrips.test`,
        passwordHash: "x",
        displayName: "Refund Idem",
        type: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const booking = await prisma.booking.create({
      data: {
        bookingRef: `OTR${suffix.toUpperCase().slice(0, 8)}`,
        type: "FLIGHT",
        status: "TICKETED",
        userId: user.id,
        providerRef: `MCK${suffix.slice(0, 6).toUpperCase()}`,
        totalAmount: 4000,
        currency: "BDT",
        snapshot: { sessionId: suffix, quotedTotal: 4000 },
      },
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 4000,
        currency: "BDT",
        status: "SUCCESS",
        method: "CARD",
        providerRef: `MOCKRF${suffix.toUpperCase()}`,
        idempotencyKey: `booking:${booking.id}:pay`,
      },
    });
    const wallet = await prisma.wallet.create({
      data: { ownerId: user.id, ownerType: "CUSTOMER", currency: "BDT", status: "ACTIVE" },
    });
    await prisma.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        bookingId: booking.id,
        paymentId: payment.id,
        type: "CREDIT",
        amount: 4000,
        currency: "BDT",
        reference: `PAY-${payment.id}`,
        actorId: user.id,
        note: "Customer flight payment",
      },
    });

    const actor = { id: user.id, type: "CUSTOMER" };
    const results = await Promise.allSettled([
      refundBooking(booking.id, actor, { reason: "Duplicate submit A" }),
      refundBooking(booking.id, actor, { reason: "Duplicate submit B" }),
    ]);

    const fulfilled = results.filter((row) => row.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const next = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(["REFUNDED", "REFUND_PENDING", "CANCELLED"]).toContain(next.status);

    const refundDebits = await prisma.ledgerEntry.findMany({
      where: { paymentId: payment.id, type: "DEBIT", reference: { startsWith: `RF-${payment.id}` } },
    });
    expect(refundDebits).toHaveLength(1);
    expect(String(refundDebits[0].amount).replace(/\.0+$/, "")).toBe("4000");

    const refundCredits = await prisma.ledgerEntry.findMany({
      where: { bookingId: booking.id, type: "REFUND" },
    });
    expect(refundCredits).toHaveLength(0);

    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(["REFUNDED", "PARTIALLY_REFUNDED", "REFUND_INITIATED"]).toContain(paid.status);
  });
});
