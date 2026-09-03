import { registerB2b } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nidUrl = typeof body.nidUrl === "string" ? body.nidUrl.trim() : "";
  if (process.env.NODE_ENV === "production" && !nidUrl) {
    return NextResponse.json({ code: "VALIDATION", message: "NID document is required." }, { status: 400 });
  }
  return toAuthResponse(
    await registerB2b({
      ...body,
      nidUrl: nidUrl || "b2b-portal",
      tradeLicenseUrl: body.tradeLicenseUrl ?? null,
    }, requestContext(req)),
  );
}
