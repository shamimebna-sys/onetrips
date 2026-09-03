import { updateOrganization } from "@onetrips/organization";
import { jsonError, requireB2b } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const auth = requireB2b(req);
  if (auth.error) return auth.error;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ organization: await updateOrganization(auth.userId, body) });
  } catch (error) {
    return jsonError(error);
  }
}
