import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  MFA_COOKIE,
  REFRESH_COOKIE,
  type AuthHttpResult,
} from "@onetrips/auth";

export function requestContext(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const read = (name: string) => {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  };

  return {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    accessToken: read(ACCESS_COOKIE),
    refreshToken: read(REFRESH_COOKIE),
    mfaToken: read(MFA_COOKIE),
  };
}

export function toAuthResponse(result: AuthHttpResult) {
  const response = NextResponse.json(result.body, { status: result.status });
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.headers.set(name, value);
  }
  for (const cookie of result.setCookies ?? []) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  for (const name of result.clearCookies ?? []) {
    response.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return response;
}
