import { getAccessPayload } from "@onetrips/auth";
import { hotelSearchInputSchema, searchHotels, searchRequestFromQuery } from "@onetrips/hotel-search";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";
import { jsonError } from "@/lib/guard";
import { requestContext } from "@/lib/auth-http";
import { NextResponse } from "next/server";

function userIdFrom(req: Request) {
  return getAccessPayload(requestContext(req).accessToken)?.sub;
}

export async function POST(req: Request) {
  try {
    await assertHttpRateLimit(req, "search", RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
    const body = hotelSearchInputSchema.parse(await req.json());
    const result = await searchHotels(body, { userId: userIdFrom(req) });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(req: Request) {
  try {
    await assertHttpRateLimit(req, "search", RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
    const url = new URL(req.url);
    const parsed = hotelSearchInputSchema.parse(searchRequestFromQuery(url.searchParams));
    const result = await searchHotels(parsed, { userId: userIdFrom(req) });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
