import { getWorkspace } from "@onetrips/organization";
import { jsonError, requireB2b } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireB2b(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getWorkspace(auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
