import { filtersFromQuery, getHotelSearchSession } from "@onetrips/hotel-search";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const result = await getHotelSearchSession(id, filtersFromQuery(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
