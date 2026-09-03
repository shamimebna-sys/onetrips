import { filtersFromQuery, getHotelSearchSession } from "@onetrips/hotel-search";
import { jsonError, requireActiveB2b } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    return NextResponse.json(await getHotelSearchSession(id, filtersFromQuery(url.searchParams)));
  } catch (error) {
    return jsonError(error);
  }
}
