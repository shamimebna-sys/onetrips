import { NextResponse } from "next/server";
import { assertMutationOrigin, publicErrorPayload } from "@onetrips/observability";
import { type PermissionCode } from "@onetrips/shared";
import { assertPermission, getAccessPayload } from "@onetrips/auth";
import { getMembership, requireActiveOrganization } from "@onetrips/organization";
import { requestContext } from "./auth-http";

export function jsonError(error: unknown) {
  const payload = publicErrorPayload(error);
  const response = NextResponse.json(payload.body, { status: payload.status });
  for (const [name, value] of Object.entries(payload.headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export function requireB2b(req: Request) {
  try {
    assertMutationOrigin(req);
  } catch (error) {
    return { error: jsonError(error) };
  }
  const payload = getAccessPayload(requestContext(req).accessToken);
  if (!payload) {
    return {
      error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Please sign in." }, { status: 401 }),
    };
  }
  if (payload.type !== "B2B") {
    return {
      error: NextResponse.json({ code: "FORBIDDEN", message: "Agency account required." }, { status: 403 }),
    };
  }
  return { userId: payload.sub, payload };
}

export function requireB2bPermission(req: Request, permission: PermissionCode) {
  const auth = requireB2b(req);
  if (auth.error) return auth;
  try {
    assertPermission(auth.payload, permission);
  } catch (error) {
    return { error: jsonError(error) };
  }
  return auth;
}

export async function requireB2bMembership(req: Request, permission?: PermissionCode) {
  const auth = permission ? requireB2bPermission(req, permission) : requireB2b(req);
  if (auth.error) return auth;
  try {
    const membership = await getMembership(auth.userId);
    return { ...auth, membership, organizationId: membership.organizationId };
  } catch (error) {
    return { error: jsonError(error) };
  }
}

export async function requireActiveB2b(req: Request, permission?: PermissionCode) {
  const auth = permission ? requireB2bPermission(req, permission) : requireB2b(req);
  if (auth.error) return auth;
  try {
    const membership = await requireActiveOrganization(auth.userId);
    return { ...auth, membership, organizationId: membership.organizationId };
  } catch (error) {
    return { error: jsonError(error) };
  }
}
