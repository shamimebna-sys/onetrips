import { me } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";

export async function GET(req: Request) {
  return toAuthResponse(await me(requestContext(req)));
}
