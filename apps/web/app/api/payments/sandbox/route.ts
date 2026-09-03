import { completeSandboxPayment, sandboxSession } from "@onetrips/payments";
import { jsonError } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  if (!ref) return NextResponse.json({ code: "VALIDATION", message: "Missing ref." }, { status: 400 });
  const session = sandboxSession(ref);
  if (!session) return NextResponse.json({ code: "PAYMENT_NOT_FOUND", message: "Unknown session." }, { status: 404 });
  return NextResponse.json({ session });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { providerRef?: string; outcome?: "SUCCESS" | "FAILED" };
    if (!body.providerRef || (body.outcome !== "SUCCESS" && body.outcome !== "FAILED")) {
      return NextResponse.json({ code: "VALIDATION", message: "providerRef and outcome are required." }, { status: 400 });
    }
    const result = await completeSandboxPayment(body.providerRef, body.outcome);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
