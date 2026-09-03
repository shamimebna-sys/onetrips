import { prisma } from "@onetrips/database";
import type { BookingStatus } from "@onetrips/database";
import { z } from "zod";

const BOOKING_STATUSES = [
  "SEARCHED",
  "SELECTED",
  "REVALIDATING",
  "PRICE_CONFIRMED",
  "PRICE_CHANGED",
  "UNAVAILABLE",
  "PASSENGER_PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "BOOKING_PENDING",
  "BOOKED",
  "BOOKING_FAILED",
  "BOOKING_UNKNOWN",
  "TICKETING_PENDING",
  "TICKETED",
  "TICKETING_FAILED",
  "TICKETING_UNKNOWN",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "EXPIRED",
] as const;

export const adminBookingQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  q: z.string().trim().max(64).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

function money(value: unknown) {
  return Number(value ?? 0);
}

export async function listAdminBookings(input: unknown = {}) {
  const data = adminBookingQuerySchema.parse(input ?? {});
  const q = data.q || undefined;
  const rows = await prisma.booking.findMany({
    where: {
      ...(data.status ? { status: data.status as BookingStatus } : {}),
      ...(q
        ? {
            OR: [
              { bookingRef: { contains: q } },
              { providerRef: { contains: q } },
              { user: { email: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      segments: { orderBy: { sequenceNo: "asc" }, take: 1 },
      user: { select: { email: true, displayName: true, type: true } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: data.take ?? 80,
  });
  return rows.map((row) => ({
    id: row.id,
    bookingRef: row.bookingRef,
    status: row.status,
    type: row.type,
    totalAmount: money(row.totalAmount),
    currency: row.currency,
    providerRef: row.providerRef,
    createdAt: row.createdAt.toISOString(),
    origin: row.segments[0]?.origin ?? null,
    destination: row.segments[0]?.destination ?? null,
    ownerEmail: row.user?.email ?? null,
    ownerName: row.user?.displayName ?? null,
    organizationName: row.organization?.name ?? null,
  }));
}
