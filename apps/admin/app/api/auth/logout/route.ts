import { logout } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";

export async function POST(req: Request) {
  return toAuthResponse(await logout(requestContext(req)));
}
