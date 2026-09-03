import { listBookings } from "@onetrips/booking";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ bookings: await listBookings(auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}
