import { getTicketPdf } from "@onetrips/ticketing";
import { jsonError, requireB2bMembership } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string; ticketNumber: string }> }) {
  const auth = await requireB2bMembership(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id, ticketNumber } = await context.params;
    const file = await getTicketPdf(id, ticketNumber, auth.userId);
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
