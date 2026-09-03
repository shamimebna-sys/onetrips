import { getHotelDetails } from "@onetrips/hotel-search";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(_req: Request, context: { params: Promise<{ id: string; hotelId: string }> }) {
  try {
    const { id, hotelId } = await context.params;
    return NextResponse.json(await getHotelDetails(id, decodeURIComponent(hotelId)));
  } catch (error) {
    return jsonError(error);
  }
}
