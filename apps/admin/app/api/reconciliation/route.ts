import { getReconciliationReport } from "@onetrips/refunds";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.REPORT_VIEW);
  if (auth.error) return auth.error;
  try {
    const take = Number(new URL(req.url).searchParams.get("take") || "80");
    return NextResponse.json(await getReconciliationReport(Number.isFinite(take) ? take : 80));
  } catch (error) {
    return jsonError(error);
  }
}
