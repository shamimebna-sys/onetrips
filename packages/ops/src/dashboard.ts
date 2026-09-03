import { prisma } from "@onetrips/database";
import { catalogSummary } from "@onetrips/catalog";

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getOpsDashboard() {
  const today = startOfUtcDay();
  const [
    catalog,
    bookingsTotal,
    bookingsToday,
    ticketed,
    ticketingFailed,
    paymentPending,
    bookedOrTicketed,
    refundPending,
    cancelled,
    customers,
    agenciesPending,
    agenciesActive,
    invoicesOpen,
    paymentSum,
  ] = await Promise.all([
    catalogSummary(),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: today } } }),
    prisma.booking.count({ where: { status: "TICKETED" } }),
    prisma.booking.count({ where: { status: "TICKETING_FAILED" } }),
    prisma.booking.count({ where: { status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED"] } } }),
    prisma.booking.count({ where: { status: { in: ["BOOKED", "TICKETING_PENDING", "TICKETED"] } } }),
    prisma.booking.count({ where: { status: "REFUND_PENDING" } }),
    prisma.booking.count({ where: { status: { in: ["CANCELLED", "REFUNDED"] } } }),
    prisma.user.count({ where: { type: "CUSTOMER", deletedAt: null } }),
    prisma.organization.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.organization.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.invoice.count({ where: { status: { in: ["ISSUED", "PAID"] } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
  ]);

  return {
    catalog,
    bookings: {
      total: bookingsTotal,
      today: bookingsToday,
      ticketed,
      ticketingFailed,
      paymentPending,
      confirmed: bookedOrTicketed,
      refundPending,
      cancelled,
    },
    customers,
    agencies: { pending: agenciesPending, active: agenciesActive },
    invoices: invoicesOpen,
    revenueCaptured: money(paymentSum._sum.amount),
    currency: "BDT",
  };
}
