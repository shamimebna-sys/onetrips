import { catalogSummary } from "@onetrips/catalog";
import { PERMISSIONS } from "@onetrips/shared";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_VIEW);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await catalogSummary());
  } catch (error) {
    return jsonError(error);
  }
}
