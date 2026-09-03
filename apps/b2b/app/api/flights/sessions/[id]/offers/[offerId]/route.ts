import { getOffer } from "@onetrips/flight-search";
import { jsonError, requireB2bPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string; offerId: string }> }) {
  const auth = requireB2bPermission(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id, offerId } = await context.params;
    return NextResponse.json(await getOffer(id, decodeURIComponent(offerId)));
  } catch (error) {
    return jsonError(error);
  }
}
