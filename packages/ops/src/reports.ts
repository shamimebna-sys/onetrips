import { prisma } from "@onetrips/database";

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function getOpsReport() {
  const monthStart = startOfUtcMonth();
  const [bookingsByStatus, paymentsByStatus, monthPayments, monthBookings, invoiceSum] = await Promise.all([
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.invoice.aggregate({ where: { status: { not: "VOID" } }, _sum: { total: true }, _count: true }),
  ]);

  return {
    monthStart: monthStart.toISOString(),
    bookingsThisMonth: monthBookings,
    capturedThisMonth: money(monthPayments._sum.amount),
    capturedThisMonthCount: monthPayments._count,
    invoices: { count: invoiceSum._count, total: money(invoiceSum._sum.total) },
    bookingsByStatus: bookingsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    paymentsByStatus: paymentsByStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
      amount: money(row._sum.amount),
    })),
  };
}
