import { applyPromoToBooking } from "@onetrips/promotions";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertHttpRateLimit, assertSameOrigin, RATE_LIMITS } from "@onetrips/observability";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    await assertHttpRateLimit(req, "promo", RATE_LIMITS.promo.limit, RATE_LIMITS.promo.windowMs);
    const { id } = await context.params;
    return NextResponse.json({ promo: await applyPromoToBooking(id, auth.userId, await req.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
