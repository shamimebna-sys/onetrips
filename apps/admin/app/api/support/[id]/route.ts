import { updateSupportRequest } from "@onetrips/support";
import { jsonError, requireAdmin } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ request: await updateSupportRequest(id, await req.json(), auth.payload?.sub ?? "admin") });
  } catch (error) {
    return jsonError(error);
  }
}
