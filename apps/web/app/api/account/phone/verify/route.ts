import { verifyPhone } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ profile: await verifyPhone(auth.userId, await req.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
