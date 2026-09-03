import { verifyPayment } from "@onetrips/payments";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { paymentId?: string };
    if (!body.paymentId) {
      return NextResponse.json({ code: "VALIDATION", message: "paymentId is required." }, { status: 400 });
    }
    const result = await verifyPayment(body.paymentId, auth.userId);
    if (result.payment.bookingId !== id) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Payment does not belong to this booking." }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
