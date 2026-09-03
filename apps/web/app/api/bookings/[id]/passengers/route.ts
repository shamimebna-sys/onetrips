import { savePassengers } from "@onetrips/booking";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ booking: await savePassengers(id, auth.userId, await req.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
