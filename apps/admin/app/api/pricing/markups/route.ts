import { createMarkupRule, listMarkupRules } from "@onetrips/pricing";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.MARKUP_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ rules: await listMarkupRules() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = requireAdminPermission(req, PERMISSIONS.MARKUP_MANAGE);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ rule: await createMarkupRule(await req.json()) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
