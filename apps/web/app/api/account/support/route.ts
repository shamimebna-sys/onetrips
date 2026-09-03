import { createSupportRequest, listSupportRequests } from "@onetrips/support";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertHttpRateLimit, assertSameOrigin } from "@onetrips/observability";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ requests: await listSupportRequests(auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    await assertHttpRateLimit(req, "support", 8, 15 * 60_000);
    return NextResponse.json({ request: await createSupportRequest(auth.userId, await req.json().catch(() => ({}))) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
