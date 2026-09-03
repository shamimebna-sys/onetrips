import { listInbox, markInboxRead } from "@onetrips/notifications";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@onetrips/observability";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";
    return NextResponse.json(await listInbox(auth.userId, unreadOnly));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    return NextResponse.json(await markInboxRead(auth.userId, body.id));
  } catch (error) {
    return jsonError(error);
  }
}
