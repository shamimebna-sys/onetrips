import { getMembership } from "@onetrips/organization";
import { getInvoicePdfForOrganization } from "@onetrips/finance";
import { jsonError, requireB2bPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireB2bPermission(req, PERMISSIONS.LEDGER_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const membership = await getMembership(auth.userId);
    const file = await getInvoicePdfForOrganization(id, membership.organizationId);
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
