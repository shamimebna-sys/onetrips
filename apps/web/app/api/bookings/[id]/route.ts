import { getBooking } from "@onetrips/booking";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(_req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ booking: await getBooking(id, auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}
