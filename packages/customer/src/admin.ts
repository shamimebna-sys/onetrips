import { prisma } from "@onetrips/database";
import type { UserStatus } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().max(64).optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export async function listAdminCustomers(input: unknown = {}) {
  const data = querySchema.parse(input ?? {});
  const q = data.q || undefined;
  const rows = await prisma.user.findMany({
    where: {
      type: "CUSTOMER",
      deletedAt: null,
      ...(data.status ? { status: data.status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { phone: { contains: q } },
              { displayName: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: data.take ?? 80,
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.displayName,
    status: row.status,
    phoneVerified: Boolean(row.phoneVerifiedAt),
    firstName: row.customer?.firstName ?? null,
    lastName: row.customer?.lastName ?? null,
    bookingCount: row._count.bookings,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getAdminCustomer(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customer: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          bookingRef: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row || row.type !== "CUSTOMER" || row.deletedAt) {
    throw new DomainError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.displayName,
    status: row.status,
    phoneVerified: Boolean(row.phoneVerifiedAt),
    firstName: row.customer?.firstName ?? null,
    lastName: row.customer?.lastName ?? null,
    dateOfBirth: row.customer?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: row.customer?.gender ?? null,
    nationality: row.customer?.nationalityId ?? null,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    bookings: row.bookings.map((booking) => ({
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      currency: booking.currency,
      createdAt: booking.createdAt.toISOString(),
    })),
  };
}

export async function setCustomerStatus(userId: string, status: UserStatus) {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row || row.type !== "CUSTOMER" || row.deletedAt) {
    throw new DomainError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
  await prisma.user.update({ where: { id: userId }, data: { status } });
  await prisma.auditLog.create({
    data: {
      actorType: "ADMIN",
      action: "CUSTOMER_STATUS",
      entityType: "User",
      entityId: userId,
      previousState: { status: row.status },
      newState: { status },
    },
  });
  return getAdminCustomer(userId);
}
