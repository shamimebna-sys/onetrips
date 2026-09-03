import { getOffer } from "@onetrips/flight-search";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(_req: Request, context: { params: Promise<{ id: string; offerId: string }> }) {
  try {
    const { id, offerId } = await context.params;
    return NextResponse.json(await getOffer(id, decodeURIComponent(offerId)));
  } catch (error) {
    return jsonError(error);
  }
}
