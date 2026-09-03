import { searchAirports } from "@onetrips/catalog";
import { jsonError, requireB2b } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireB2b(req);
  if (auth.error) return auth.error;
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const airports = await searchAirports({ q, limit: 20 });
    return NextResponse.json({ airports });
  } catch (error) {
    return jsonError(error);
  }
}
