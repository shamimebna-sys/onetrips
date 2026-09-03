import { issueTicketsForCustomer } from "@onetrips/ticketing";
import { jsonError, requireActiveB2b } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveB2b(req, PERMISSIONS.BOOKING_CREATE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const result = await issueTicketsForCustomer(id, auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
