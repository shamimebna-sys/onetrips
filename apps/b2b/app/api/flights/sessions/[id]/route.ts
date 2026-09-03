import { filtersFromQuery, getSearchSession } from "@onetrips/flight-search";
import { jsonError, requireB2bPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireB2bPermission(req, PERMISSIONS.BOOKING_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const result = await getSearchSession(id, filtersFromQuery(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
