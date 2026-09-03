import { createPlatformUser, listPlatformUsers } from "@onetrips/auth";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.USER_MANAGE);
  if (auth.error) return auth.error;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    return NextResponse.json({
      users: await listPlatformUsers({
        status: status && status !== "ALL" ? status : undefined,
        q: url.searchParams.get("q") || undefined,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.USER_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ user: await createPlatformUser(await req.json(), auth.payload.sub) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
