import { forgotPassword } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";
import { jsonError } from "@/lib/guard";
import { assertHttpRateLimit, assertSameOrigin, RATE_LIMITS } from "@onetrips/observability";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await assertHttpRateLimit(req, "otp", RATE_LIMITS.otp.limit, RATE_LIMITS.otp.windowMs);
    const body = await req.json().catch(() => ({}));
    return toAuthResponse(await forgotPassword(body, requestContext(req)));
  } catch (error) {
    return jsonError(error);
  }
}
