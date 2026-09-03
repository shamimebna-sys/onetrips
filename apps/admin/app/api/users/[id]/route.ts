import { setPlatformUserRole, setPlatformUserStatus } from "@onetrips/auth";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS, type PlatformRole } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.USER_MANAGE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { status?: string; role?: PlatformRole };
    if (body.status) {
      return NextResponse.json({
        user: await setPlatformUserStatus(id, body.status as "ACTIVE" | "SUSPENDED" | "DISABLED", auth.payload.sub),
      });
    }
    if (body.role) {
      return NextResponse.json({ user: await setPlatformUserRole(id, body.role, auth.payload.sub) });
    }
    return NextResponse.json({ code: "VALIDATION", message: "status or role is required." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
