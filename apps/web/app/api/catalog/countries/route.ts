import { listCountries } from "@onetrips/catalog";
import { NextResponse } from "next/server";

export async function GET() {
  const countries = await listCountries();
  return NextResponse.json({
    countries: countries.map((country) => ({ code: country.code, name: country.name })),
  });
}
