import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
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
}

loadEnv();

const prisma = new PrismaClient();

export async function assertBookingState(bookingRef: string, ownerEmail: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: {
      user: true,
      payments: true,
      tickets: true,
      invoices: true,
      ledger: true,
    },
  });
  if (!booking) throw new Error(`Booking ${bookingRef} not found`);
  if (booking.user?.email !== ownerEmail) {
    throw new Error(`Booking ${bookingRef} owner ${booking.user?.email} !== ${ownerEmail}`);
  }
  if (booking.organizationId) {
    throw new Error("Customer booking must have organizationId NULL");
  }
  const payment = booking.payments.find((row) => row.status === "SUCCESS");
  if (!payment) throw new Error("Expected SUCCESS payment");
  if (!booking.tickets.length) throw new Error("Expected tickets");
  if (!booking.invoices.length) throw new Error("Expected invoice");
  const notified = await prisma.notificationLog.count({
    where: { OR: [{ recipient: ownerEmail }, { userId: booking.userId ?? undefined }] },
  });
  return {
    id: booking.id,
    status: booking.status,
    pnr: booking.providerRef,
    paymentStatus: payment.status,
    tickets: booking.tickets.length,
    invoices: booking.invoices.length,
    ledger: booking.ledger.length,
    notifications: notified,
  };
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
