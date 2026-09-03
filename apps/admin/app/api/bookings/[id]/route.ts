import { getBookingById } from "@onetrips/booking";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ booking: await getBookingById(id) });
  } catch (error) {
    return jsonError(error);
  }
}
