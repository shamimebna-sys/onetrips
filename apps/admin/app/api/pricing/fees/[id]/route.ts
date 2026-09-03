import { updateServiceFeeRule } from "@onetrips/pricing";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.MARKUP_MANAGE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ rule: await updateServiceFeeRule(id, await req.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
