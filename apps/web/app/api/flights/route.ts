import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      code: "MOVED",
      message: "Use POST /api/flights/search or GET /api/flights/sessions/:id.",
    },
    { status: 410 },
  );
}
