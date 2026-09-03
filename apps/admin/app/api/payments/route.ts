import { listAdminPayments } from "@onetrips/ops";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.PAYMENT_VIEW);
  if (auth.error) return auth.error;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    return NextResponse.json({
      payments: await listAdminPayments({
        status: status && status !== "ALL" ? status : undefined,
        q: url.searchParams.get("q") || undefined,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
