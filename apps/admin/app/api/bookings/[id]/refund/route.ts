import { refundBooking } from "@onetrips/refunds";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.BOOKING_REFUND);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await refundBooking(id, { id: auth.payload.sub, type: "ADMIN" }, body));
  } catch (error) {
    return jsonError(error);
  }
}
