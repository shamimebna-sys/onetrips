import { issueTicketsForCustomer } from "@onetrips/ticketing";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const result = await issueTicketsForCustomer(id, auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
