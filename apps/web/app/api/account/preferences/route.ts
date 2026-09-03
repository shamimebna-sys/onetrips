import { getPreference, updatePreference } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@onetrips/observability";

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ preference: await getPreference(auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    return NextResponse.json({ preference: await updatePreference(auth.userId, await req.json().catch(() => ({}))) });
  } catch (error) {
    return jsonError(error);
  }
}
