import { listAirports, createAirport } from "@onetrips/catalog";
import { PERMISSIONS } from "@onetrips/shared";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_VIEW);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ airports: await listAirports() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_MANAGE);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const airport = await createAirport(body);
    return NextResponse.json({ airport }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
