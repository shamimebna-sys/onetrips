import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, getAccessPayload } from "@onetrips/auth";
import { applySecurityHeaders } from "@onetrips/observability/headers";
import { isSafeReturnPath } from "@onetrips/shared";

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
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const payload = getAccessPayload(access);
  const hasSession = Boolean(payload || refresh);

  const isDashboard = pathname.startsWith("/dashboard");
  const isAccount = pathname.startsWith("/account");
  const isBooking = pathname.startsWith("/booking");
  const isWelcome = pathname.startsWith("/welcome");

  if (payload && pathname.startsWith("/login/customer")) {
    const next = request.nextUrl.searchParams.get("next");
    const dest =
      payload.type === "B2B"
        ? "/dashboard"
        : payload.type === "ADMIN"
          ? process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001"
          : isSafeReturnPath(next)
            ? next
            : "/account";
    return finalize(request, NextResponse.redirect(new URL(dest, request.url)));
  }

  if ((isDashboard || isAccount || isBooking || isWelcome) && !hasSession) {
    const login = new URL(isDashboard ? "/login" : "/login/customer", request.url);
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return finalize(request, NextResponse.redirect(login));
  }

  if (payload && isDashboard && payload.type === "CUSTOMER") {
    return finalize(request, NextResponse.redirect(new URL("/account", request.url)));
  }

  if (payload && (isAccount || isBooking) && payload.type === "B2B") {
    return finalize(request, NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return finalize(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
