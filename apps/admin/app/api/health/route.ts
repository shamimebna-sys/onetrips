import { getHealth } from "@onetrips/observability";
import { NextResponse } from "next/server";

export async function GET() {
  const health = await getHealth("admin");
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
