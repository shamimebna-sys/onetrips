import { verifyOtp } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return toAuthResponse(await verifyOtp(body, requestContext(req)));
}
