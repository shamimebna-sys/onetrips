import { getAdminCustomer, setCustomerStatus } from "@onetrips/customer";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.CUSTOMER_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ customer: await getAdminCustomer(id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.CUSTOMER_UPDATE);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { status?: "ACTIVE" | "SUSPENDED" | "DISABLED" };
    if (!body.status) {
      return NextResponse.json({ code: "VALIDATION", message: "status is required." }, { status: 400 });
    }
    return NextResponse.json({ customer: await setCustomerStatus(id, body.status) });
  } catch (error) {
    return jsonError(error);
  }
}
