import { updateAirport } from "@onetrips/catalog";
import { PERMISSIONS } from "@onetrips/shared";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_MANAGE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = await req.json();
    return NextResponse.json({ airport: await updateAirport(id, body) });
  } catch (error) {
    return jsonError(error);
  }
}
