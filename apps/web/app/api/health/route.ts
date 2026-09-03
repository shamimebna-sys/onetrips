import { NextResponse } from "next/server";
import { getHealth } from "@onetrips/observability";

export async function GET() {
  const health = await getHealth("web");
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
