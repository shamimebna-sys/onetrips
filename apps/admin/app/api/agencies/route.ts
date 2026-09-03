import { listOrganizations } from "@onetrips/organization";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.B2B_VIEW);
  if (auth.error) return auth.error;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | null;
    return NextResponse.json({ organizations: await listOrganizations(status ?? undefined) });
  } catch (error) {
    return jsonError(error);
  }
}
