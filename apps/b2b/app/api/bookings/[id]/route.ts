import { getBooking } from "@onetrips/booking";
import { jsonError, requireB2bMembership } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireB2bMembership(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const booking = await getBooking(id, auth.userId);
    if (booking.organization?.id !== auth.organizationId) {
      return NextResponse.json({ code: "FORBIDDEN", message: "You cannot access this booking." }, { status: 403 });
    }
    return NextResponse.json({ booking });
  } catch (error) {
    return jsonError(error);
  }
}
