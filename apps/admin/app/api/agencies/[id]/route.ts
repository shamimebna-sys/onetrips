import { getOrganizationAdmin, setOrganizationStatus } from "@onetrips/organization";
import { depositToWallet, setCreditLimit } from "@onetrips/finance";
import { jsonError, requireAdminPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminPermission(req, PERMISSIONS.B2B_VIEW);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await getOrganizationAdmin(id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    creditLimit?: number;
    deposit?: number;
    note?: string;
  };

  try {
    if (body.status) {
      const auth = requireAdminPermission(req, PERMISSIONS.B2B_MANAGE);
      if (auth.error) return auth.error;
      return NextResponse.json(await setOrganizationStatus(id, { status: body.status }));
    }
    if (typeof body.creditLimit === "number") {
      const auth = requireAdminPermission(req, PERMISSIONS.B2B_CREDIT_MANAGE);
      if (auth.error) return auth.error;
      const wallet = await setCreditLimit(id, { creditLimit: body.creditLimit });
      return NextResponse.json({ wallet });
    }
    if (typeof body.deposit === "number") {
      const auth = requireAdminPermission(req, PERMISSIONS.WALLET_DEPOSIT);
      if (auth.error) return auth.error;
      const wallet = await depositToWallet(id, "ORGANIZATION", auth.payload.sub, {
        amount: body.deposit,
        note: body.note || "Admin deposit",
      });
      return NextResponse.json({ wallet });
    }
    return NextResponse.json({ code: "VALIDATION", message: "No supported field." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
