import { registerCustomer } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";
import { jsonError } from "@/lib/guard";
import { assertMutationOrigin } from "@onetrips/observability";

export async function POST(req: Request) {
  try {
    assertMutationOrigin(req);
    const body = await req.json().catch(() => ({}));
    return toAuthResponse(await registerCustomer(body, requestContext(req)));
  } catch (error) {
    return jsonError(error);
  }
}
