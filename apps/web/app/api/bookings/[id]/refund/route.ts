import { refundBookingForCustomer } from "@onetrips/refunds";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertHttpRateLimit, assertSameOrigin, RATE_LIMITS } from "@onetrips/observability";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    await assertHttpRateLimit(req, "payment", RATE_LIMITS.payment.limit, RATE_LIMITS.payment.windowMs);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await refundBookingForCustomer(id, auth.userId, body));
  } catch (error) {
    return jsonError(error);
  }
}
