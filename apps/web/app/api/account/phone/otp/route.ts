import { requestPhoneOtp } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "otp", RATE_LIMITS.otp.limit, RATE_LIMITS.otp.windowMs);
    const otp = await requestPhoneOtp(auth.userId, await req.json());
    return NextResponse.json({
      message: "Verification code sent.",
      ...(otp.devCode ? { devCode: otp.devCode } : {}),
    });
  } catch (error) {
    return jsonError(error);
  }
}
