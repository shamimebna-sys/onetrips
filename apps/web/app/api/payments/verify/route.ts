import { verifyPayment } from "@onetrips/payments";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@onetrips/observability";
import { z } from "zod";

const schema = z.object({
  paymentId: z.string().trim().min(8).max(64),
});

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    const body = schema.parse(await req.json().catch(() => ({})));
    return NextResponse.json(await verifyPayment(body.paymentId, auth.userId));
  } catch (error) {
    return jsonError(error);
  }
}
