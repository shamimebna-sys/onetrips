import { createCity, listCities } from "@onetrips/catalog";
import { PERMISSIONS } from "@onetrips/shared";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_VIEW);
  if (auth.error) return auth.error;
  try {
    const countryId = new URL(req.url).searchParams.get("countryId") ?? undefined;
    return NextResponse.json({ cities: await listCities(countryId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ city: await createCity(await req.json()) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
