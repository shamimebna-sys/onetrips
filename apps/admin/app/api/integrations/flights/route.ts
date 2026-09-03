import { getFlightProviderSnapshot } from "@onetrips/flight-search";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.REPORT_VIEW);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getFlightProviderSnapshot());
  } catch (error) {
    return jsonError(error);
  }
}
