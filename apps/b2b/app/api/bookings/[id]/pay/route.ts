import { payWithOrganizationWallet } from "@onetrips/payments";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";
import { jsonError, requireActiveB2b } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_CREATE);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "payment", RATE_LIMITS.payment.limit, RATE_LIMITS.payment.windowMs);
    const { id } = await context.params;
    await req.json().catch(() => ({}));
    const result = await payWithOrganizationWallet(id, auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
