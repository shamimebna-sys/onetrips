import { createCountry, listCountries } from "@onetrips/catalog";
import { PERMISSIONS } from "@onetrips/shared";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_VIEW);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ countries: await listCountries() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.CATALOG_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ country: await createCountry(await req.json()) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
