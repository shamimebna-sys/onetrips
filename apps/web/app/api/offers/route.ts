import { listActivePromotions } from "@onetrips/promotions";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const promotions = await listActivePromotions();
    return NextResponse.json({
      offers: promotions.map((row) => ({
        code: row.code,
        name: row.name,
        description: row.description,
        endsAt: row.endsAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
