import { prisma } from "@onetrips/database";
import type { PaymentStatus } from "@onetrips/database";
import { z } from "zod";

const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "EXPIRED",
  "REFUND_INITIATED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

const querySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  q: z.string().trim().max(64).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

export async function listAdminPayments(input: unknown = {}) {
  const data = querySchema.parse(input ?? {});
  const q = data.q || undefined;
  const rows = await prisma.payment.findMany({
    where: {
      ...(data.status ? { status: data.status as PaymentStatus } : {}),
      ...(q
        ? {
            OR: [
              { providerRef: { contains: q } },
              { idempotencyKey: { contains: q } },
              { booking: { bookingRef: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { booking: { select: { id: true, bookingRef: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: data.take ?? 80,
  });
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    method: row.method,
    amount: money(row.amount),
    currency: row.currency,
    providerRef: row.providerRef,
    bookingId: row.bookingId,
    bookingRef: row.booking.bookingRef,
    bookingStatus: row.booking.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
