import { getNotificationOverview, listNotificationLogs } from "@onetrips/notifications";
import { jsonError, requireAdmin } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const overview = await getNotificationOverview();
    if (status === "QUEUED" || status === "SENT" || status === "FAILED") {
      overview.logs = await listNotificationLogs({ status, take: 80 });
    }
    return NextResponse.json(overview);
  } catch (error) {
    return jsonError(error);
  }
}
