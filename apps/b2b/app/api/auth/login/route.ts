import { login } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";
import { jsonError } from "@/lib/guard";
import { assertMutationOrigin } from "@onetrips/observability";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    assertMutationOrigin(req);
    const body = await req.json().catch(() => ({}));
    const result = await login(body, requestContext(req));
    const user = result.body.user as { type?: string } | undefined;
    if (result.body.mfaRequired || (user && user.type !== "B2B")) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Use the agency portal with a B2B account." }, { status: 403 });
    }
    return toAuthResponse(result);
  } catch (error) {
    return jsonError(error);
  }
}
