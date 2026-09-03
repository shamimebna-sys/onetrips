import { listCountries } from "@onetrips/catalog";
import { jsonError, requireB2b } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireB2b(req);
  if (auth.error) return auth.error;
  try {
    const countries = await listCountries();
    return NextResponse.json({
      countries: countries.map((country) => ({ code: country.code, name: country.name })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
