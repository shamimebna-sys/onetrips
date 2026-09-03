import { createPassenger, listPassengers } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertHttpRateLimit, RATE_LIMITS } from "@onetrips/observability";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ passengers: await listPassengers(auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    await assertHttpRateLimit(req, "account", RATE_LIMITS.account.limit, RATE_LIMITS.account.windowMs);
    return NextResponse.json({ passenger: await createPassenger(auth.userId, await req.json()) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
