import { retryNotification } from "@onetrips/notifications";
import { jsonError, requireAdmin } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await retryNotification(id));
  } catch (error) {
    return jsonError(error);
  }
}
