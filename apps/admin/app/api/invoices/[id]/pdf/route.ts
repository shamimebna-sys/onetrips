import { getInvoicePdf } from "@onetrips/finance";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.LEDGER_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const file = await getInvoicePdf(id);
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
