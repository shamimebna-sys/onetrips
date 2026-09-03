import { listAirlines } from "@onetrips/catalog";
import { NextResponse } from "next/server";

export async function GET() {
  const airlines = await listAirlines(true);
  return NextResponse.json({ airlines });
}
