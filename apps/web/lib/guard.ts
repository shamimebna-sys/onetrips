import { NextResponse } from "next/server";
import { assertMutationOrigin, publicErrorPayload } from "@onetrips/observability";
import { resolveSession } from "@onetrips/auth";
import { applySessionCookies, getRequestContext } from "./auth-http";

export function jsonError(error: unknown) {
  const payload = publicErrorPayload(error);
  const response = NextResponse.json(payload.body, { status: payload.status });
  for (const [name, value] of Object.entries(payload.headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export async function requireCustomer(req: Request) {
  try {
    assertMutationOrigin(req);
  } catch (error) {
    return { error: jsonError(error) };
  }
  try {
    const resolved = await resolveSession(await getRequestContext(req));
    if (!resolved) {
      return {
        error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Please sign in." }, { status: 401 }),
      };
    }
    if (resolved.payload.type !== "CUSTOMER") {
      return {
        error: NextResponse.json({ code: "FORBIDDEN", message: "Customer account required." }, { status: 403 }),
      };
    }
    await applySessionCookies(resolved.setCookies);
    return { userId: resolved.payload.sub };
  } catch (error) {
    return { error: jsonError(error) };
  }
}
