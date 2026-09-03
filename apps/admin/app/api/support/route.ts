import { listSupportQueue } from "@onetrips/support";
import { jsonError, requireAdmin } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const status = new URL(req.url).searchParams.get("status") || undefined;
    return NextResponse.json({ requests: await listSupportQueue(status ?? undefined) });
  } catch (error) {
    return jsonError(error);
  }
}
