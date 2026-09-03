import { getMembership } from "@onetrips/organization";
import { listLedger } from "@onetrips/finance";
import { jsonError, requireB2bPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireB2bPermission(req, PERMISSIONS.LEDGER_VIEW);
  if (auth.error) return auth.error;
  try {
    const membership = await getMembership(auth.userId);
    return NextResponse.json({ entries: await listLedger(membership.organizationId, "ORGANIZATION") });
  } catch (error) {
    return jsonError(error);
  }
}
