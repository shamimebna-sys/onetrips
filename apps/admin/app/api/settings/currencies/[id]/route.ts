import { setCurrencyActive } from "@onetrips/ops";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.SETTINGS_MANAGE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { isActive?: boolean };
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ code: "VALIDATION", message: "isActive is required." }, { status: 400 });
    }
    return NextResponse.json({ currency: await setCurrencyActive(id, body.isActive) });
  } catch (error) {
    return jsonError(error);
  }
}
