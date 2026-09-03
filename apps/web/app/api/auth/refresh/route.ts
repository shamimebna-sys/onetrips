import { refresh } from "@onetrips/auth";
import { getRequestContext, toAuthResponse } from "@/lib/auth-http";

export async function POST(req: Request) {
  return toAuthResponse(await refresh(await getRequestContext(req)));
}
