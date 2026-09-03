import { getOpsDashboard } from "@onetrips/ops";
import { jsonError, requireAdmin } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getOpsDashboard());
  } catch (error) {
    return jsonError(error);
  }
}
