import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, getAccessPayload } from "@onetrips/auth";
import { applySecurityHeaders } from "@onetrips/observability/headers";

function finalize(request: NextRequest, response?: NextResponse) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  if (!response) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    applySecurityHeaders(requestHeaders, nonce);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  applySecurityHeaders(response.headers, nonce);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health")
  ) {
    return finalize(request);
  }

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const payload = getAccessPayload(access);

  if (!payload && !refresh) {
    return finalize(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  if (payload && payload.type !== "ADMIN") {
    return finalize(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  return finalize(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
