import { hotelSearchInputSchema, searchHotels, searchRequestFromQuery } from "@onetrips/hotel-search";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";
import { jsonError, requireActiveB2b } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "search", RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
    const body = hotelSearchInputSchema.parse(await req.json());
    const result = await searchHotels(body, { userId: auth.userId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(req: Request) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "search", RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
    const url = new URL(req.url);
    const parsed = hotelSearchInputSchema.parse(searchRequestFromQuery(url.searchParams));
    const result = await searchHotels(parsed, { userId: auth.userId });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
