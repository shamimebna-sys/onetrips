import { listInvoices } from "@onetrips/finance";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.LEDGER_VIEW);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ invoices: await listInvoices({ take: 100 }) });
  } catch (error) {
    return jsonError(error);
  }
}
