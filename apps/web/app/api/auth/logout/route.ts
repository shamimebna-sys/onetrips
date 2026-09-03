import { logout } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";
import { jsonError } from "@/lib/guard";
import { assertMutationOrigin } from "@onetrips/observability";

export async function POST(req: Request) {
  try {
    assertMutationOrigin(req);
    return toAuthResponse(await logout(requestContext(req)));
  } catch (error) {
    return jsonError(error);
  }
}
