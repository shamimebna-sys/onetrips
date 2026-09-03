import { getSettingsOverview, upsertSystemConfig } from "@onetrips/ops";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.SETTINGS_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getSettingsOverview());
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.SETTINGS_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ config: await upsertSystemConfig(await req.json(), auth.payload.sub) });
  } catch (error) {
    return jsonError(error);
  }
}
