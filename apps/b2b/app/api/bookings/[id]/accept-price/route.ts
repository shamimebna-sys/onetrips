import { acceptPriceChange } from "@onetrips/booking";
import { jsonError, requireActiveB2b } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_CREATE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ booking: await acceptPriceChange(id, auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}
