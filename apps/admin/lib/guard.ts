import { NextResponse } from "next/server";
import { assertMutationOrigin, publicErrorPayload } from "@onetrips/observability";
import { type PermissionCode } from "@onetrips/shared";
import { assertPermission, getAccessPayload } from "@onetrips/auth";
import { requestContext } from "./auth-http";

export function jsonError(error: unknown) {
  const payload = publicErrorPayload(error);
  const response = NextResponse.json(payload.body, { status: payload.status });
  for (const [name, value] of Object.entries(payload.headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export function requireAdmin(req: Request) {
  try {
    assertMutationOrigin(req);
  } catch (error) {
    return { payload: undefined, error: jsonError(error) };
  }
  const payload = getAccessPayload(requestContext(req).accessToken);
  if (!payload || payload.type !== "ADMIN") {
    return {
      payload: undefined,
      error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Please sign in." }, { status: 401 }),
    };
  }
  return { payload, error: undefined };
}

export function requireAdminPermission(req: Request, permission: PermissionCode) {
  const auth = requireAdmin(req);
  if (auth.error) return auth;
  try {
    assertPermission(auth.payload, permission);
  } catch (error) {
    return { payload: undefined, error: jsonError(error) };
  }
  return { payload: auth.payload, error: undefined };
}
