import { createBookingFromOffer, listOrganizationBookings } from "@onetrips/booking";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";
import { jsonError, requireActiveB2b, requireB2bMembership } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireB2bMembership(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ bookings: await listOrganizationBookings(auth.organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_CREATE);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "booking", RATE_LIMITS.booking.limit, RATE_LIMITS.booking.windowMs);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    delete body.organizationId;
    const booking = await createBookingFromOffer(auth.userId, body);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
