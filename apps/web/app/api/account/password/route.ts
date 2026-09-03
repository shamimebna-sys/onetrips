import { updatePassword } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "login", RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
    return NextResponse.json(await updatePassword(auth.userId, await req.json()));
  } catch (error) {
    return jsonError(error);
  }
}
