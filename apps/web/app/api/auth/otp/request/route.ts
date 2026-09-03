import { requestOtp } from "@onetrips/auth";
import { toAuthResponse } from "@/lib/auth-http";
import { jsonError } from "@/lib/guard";
import { assertMutationOrigin } from "@onetrips/observability";

export async function POST(req: Request) {
  try {
    assertMutationOrigin(req);
    const body = await req.json().catch(() => ({}));
    return toAuthResponse(await requestOtp(body));
  } catch (error) {
    return jsonError(error);
  }
}
