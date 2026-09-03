import { issueTickets } from "@onetrips/ticketing";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.TICKET_ISSUE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await issueTickets(id, { id: auth.payload.sub, type: "ADMIN" }));
  } catch (error) {
    return jsonError(error);
  }
}
