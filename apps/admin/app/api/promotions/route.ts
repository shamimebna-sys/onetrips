import { createPromotion, listPromotionsAdmin } from "@onetrips/promotions";
import { jsonError, requireAdmin } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ promotions: await listPromotionsAdmin() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ promotion: await createPromotion(await req.json()) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
