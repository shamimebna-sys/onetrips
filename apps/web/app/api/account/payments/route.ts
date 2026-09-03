import { prisma } from "@onetrips/database";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const rows = await prisma.payment.findMany({
      where: { booking: { userId: auth.userId, organizationId: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { booking: { select: { id: true, bookingRef: true } } },
    });
    return NextResponse.json({
      payments: rows.map((row) => ({
        id: row.id,
        bookingId: row.bookingId,
        bookingRef: row.booking.bookingRef,
        amount: Number(row.amount),
        currency: row.currency,
        method: row.method,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
