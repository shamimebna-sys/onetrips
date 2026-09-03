import { initiatePayment } from "@onetrips/payments";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "payment", RATE_LIMITS.payment.limit, RATE_LIMITS.payment.windowMs);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const result = await initiatePayment(id, auth.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
