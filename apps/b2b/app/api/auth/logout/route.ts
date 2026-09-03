import { logout } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return toAuthResponse(await logout(requestContext(req)));
}
