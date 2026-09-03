import { prisma } from "@onetrips/database";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const rows = await prisma.invoice.findMany({
      where: { booking: { userId: auth.userId, organizationId: null }, status: { not: "VOID" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { booking: { select: { id: true, bookingRef: true } } },
    });
    return NextResponse.json({
      invoices: rows.map((row) => ({
        id: row.id,
        invoiceNo: row.invoiceNo,
        bookingId: row.bookingId,
        bookingRef: row.booking?.bookingRef,
        amount: Number(row.total),
        currency: row.currency,
        status: row.status,
        issuedAt: row.issuedAt?.toISOString() ?? row.createdAt.toISOString(),
        pdfUrl: row.bookingId ? `/api/bookings/${row.bookingId}/invoice/pdf` : null,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
