import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DomainError } from "@onetrips/shared";
import { prisma } from "@onetrips/database";
import { getBooking, listOrganizationBookings } from "./service";

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

async function agency(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const org = await prisma.organization.create({
    data: { name: `${label} ${suffix}`, type: "AGENCY", status: "ACTIVE" },
  });
  const user = await prisma.user.create({
    data: {
      email: `${label.toLowerCase()}.${suffix}@onetrips.test`,
      passwordHash: "x",
      displayName: label,
      type: "B2B",
      status: "ACTIVE",
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: user.id, role: "AGENT" },
  });
  const booking = await prisma.booking.create({
    data: {
      bookingRef: `OT${suffix.toUpperCase()}`,
      type: "FLIGHT",
      status: "TICKETED",
      userId: user.id,
      organizationId: org.id,
      totalAmount: 8000,
      currency: "BDT",
      snapshot: { sessionId: randomUUID(), quotedTotal: 8000 },
    },
  });
  return { org, user, booking };
}

describe.skipIf(!hasDb)("B2B booking isolation", () => {
  it("keeps customer bookings organizationId null and B2B bookings org-scoped", async () => {
    const customer = await prisma.user.create({
      data: {
        email: `cust.${randomUUID().slice(0, 8)}@onetrips.test`,
        passwordHash: "x",
        displayName: "Customer",
        type: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const customerBooking = await prisma.booking.create({
      data: {
        bookingRef: `OTC${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        type: "FLIGHT",
        status: "TICKETED",
        userId: customer.id,
        organizationId: null,
        totalAmount: 5000,
        currency: "BDT",
        snapshot: { sessionId: randomUUID(), quotedTotal: 5000 },
      },
    });
    expect(customerBooking.organizationId).toBeNull();

    const a = await agency("Alpha");
    const b = await agency("Bravo");
    expect(a.booking.organizationId).toBe(a.org.id);

    const listed = await listOrganizationBookings(a.org.id);
    expect(listed.map((row) => row.id)).toContain(a.booking.id);
    expect(listed.map((row) => row.id)).not.toContain(b.booking.id);
    expect(listed.map((row) => row.id)).not.toContain(customerBooking.id);

    await expect(getBooking(b.booking.id, a.user.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getBooking(a.booking.id, b.user.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getBooking(customerBooking.id, a.user.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getBooking(a.booking.id, customer.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const own = await getBooking(a.booking.id, a.user.id);
    expect(own.organization?.id).toBe(a.org.id);
  });

  it("rejects a B2B user without an organization", async () => {
    const stray = await prisma.user.create({
      data: {
        email: `stray.${randomUUID().slice(0, 8)}@onetrips.test`,
        passwordHash: "x",
        displayName: "Stray",
        type: "B2B",
        status: "ACTIVE",
      },
    });
    const { createBookingFromOffer } = await import("./service");
    await expect(createBookingFromOffer(stray.id, { sessionId: randomUUID(), offerId: "offer-x" })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("blocks org A from org B wallet, ledger, invoice, and passengers", async () => {
    const { getInvoiceForBooking, getInvoicePdfForOrganization, listInvoices, listLedger } = await import("@onetrips/finance");
    const a = await agency("WalletA");
    const b = await agency("WalletB");

    await prisma.bookingPassenger.create({
      data: {
        bookingId: b.booking.id,
        type: "ADULT",
        firstName: "Secret",
        lastName: "Passenger",
        dateOfBirth: new Date("1990-01-01"),
        nationality: "BD",
      },
    });
    const invoiceB = await prisma.invoice.create({
      data: {
        bookingId: b.booking.id,
        organizationId: b.org.id,
        invoiceNo: `INV${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
        amount: 8000,
        tax: 0,
        total: 8000,
        currency: "BDT",
        status: "ISSUED",
      },
    });
    const walletB = await prisma.wallet.upsert({
      where: { ownerId_ownerType_currency: { ownerId: b.org.id, ownerType: "ORGANIZATION", currency: "BDT" } },
      update: {},
      create: { ownerId: b.org.id, ownerType: "ORGANIZATION", currency: "BDT", status: "ACTIVE" },
    });
    await prisma.ledgerEntry.create({
      data: {
        walletId: walletB.id,
        type: "DEBIT",
        amount: 8000,
        currency: "BDT",
        reference: `BKG-${b.booking.bookingRef}`,
        actorId: b.user.id,
        bookingId: b.booking.id,
        note: "Org B debit",
      },
    });

    await expect(getBooking(b.booking.id, a.user.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getInvoiceForBooking(b.booking.id, a.user.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getInvoicePdfForOrganization(invoiceB.id, a.org.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const invoicesA = await listInvoices({ organizationId: a.org.id });
    expect(invoicesA.map((row) => row.id)).not.toContain(invoiceB.id);

    const ledgerA = await listLedger(a.org.id, "ORGANIZATION");
    expect(ledgerA.map((row) => row.reference)).not.toContain(`BKG-${b.booking.bookingRef}`);
    const ledgerB = await listLedger(b.org.id, "ORGANIZATION");
    expect(ledgerB.map((row) => row.reference)).toContain(`BKG-${b.booking.bookingRef}`);
  });
});
