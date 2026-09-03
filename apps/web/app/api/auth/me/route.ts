import { me } from "@onetrips/auth";
import { getRequestContext, toAuthResponse } from "@/lib/auth-http";

export async function GET(req: Request) {
  return toAuthResponse(await me(await getRequestContext(req)));
}
