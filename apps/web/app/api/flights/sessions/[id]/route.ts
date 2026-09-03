import { filtersFromQuery, getSearchSession } from "@onetrips/flight-search";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const result = await getSearchSession(id, filtersFromQuery(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
