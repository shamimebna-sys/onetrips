import { getHotelOffer } from "@onetrips/hotel-search";
import { jsonError, requireActiveB2b } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string; offerId: string }> }) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id, offerId } = await context.params;
    return NextResponse.json(await getHotelOffer(id, decodeURIComponent(offerId)));
  } catch (error) {
    return jsonError(error);
  }
}
