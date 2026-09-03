import { listAuditLogs } from "@onetrips/ops";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.AUDIT_VIEW);
  if (auth.error) return auth.error;
  try {
    const url = new URL(req.url);
    return NextResponse.json({
      logs: await listAuditLogs({
        q: url.searchParams.get("q") || undefined,
        take: url.searchParams.get("take") ? Number(url.searchParams.get("take")) : undefined,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
