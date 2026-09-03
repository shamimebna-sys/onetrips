import { getMembership } from "@onetrips/organization";
import { depositToWallet, getWalletSnapshot } from "@onetrips/finance";
import { jsonError, requireB2b, requireB2bPermission } from "@/lib/guard";
import { PERMISSIONS } from "@onetrips/shared";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireB2b(req);
  if (auth.error) return auth.error;
  try {
    const membership = await getMembership(auth.userId);
    return NextResponse.json({ wallet: await getWalletSnapshot(membership.organizationId, "ORGANIZATION") });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Wallet deposits must be processed by ONETRIPS finance." },
      { status: 403 },
    );
  }
  const auth = requireB2bPermission(req, PERMISSIONS.WALLET_DEPOSIT);
  if (auth.error) return auth.error;
  try {
    const membership = await getMembership(auth.userId);
    const body = await req.json().catch(() => ({}));
    const wallet = await depositToWallet(membership.organizationId, "ORGANIZATION", auth.userId, {
      ...body,
      note: body.note || "Sandbox wallet top-up",
    });
    return NextResponse.json({ wallet });
  } catch (error) {
    return jsonError(error);
  }
}
