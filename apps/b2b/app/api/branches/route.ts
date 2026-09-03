import { createBranch, listBranches } from "@onetrips/organization";
import { jsonError, requireB2b, requireB2bPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireB2b(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ branches: await listBranches(auth.userId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireB2bPermission(req, PERMISSIONS.USER_MANAGE);
  if (auth.error) return auth.error;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ branch: await createBranch(auth.userId, body) });
  } catch (error) {
    return jsonError(error);
  }
}
