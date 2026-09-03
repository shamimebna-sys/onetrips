import { createBookingFromOffer } from "@onetrips/booking";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "booking", RATE_LIMITS.booking.limit, RATE_LIMITS.booking.windowMs);
    const booking = await createBookingFromOffer(auth.userId, await req.json());
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
