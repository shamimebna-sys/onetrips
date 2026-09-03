import { getInvoicePdfForBooking } from "@onetrips/finance";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const file = await getInvoicePdfForBooking(id, auth.userId);
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
