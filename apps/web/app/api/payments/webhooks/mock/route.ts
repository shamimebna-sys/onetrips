import { handleWebhook } from "@onetrips/payments";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-onetrips-signature");
    const result = await handleWebhook(raw, signature);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
