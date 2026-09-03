import { deletePassenger, getPassenger, updatePassenger } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ passenger: await getPassenger(auth.userId, id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json({ passenger: await updatePassenger(auth.userId, id, await req.json()) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await deletePassenger(auth.userId, id));
  } catch (error) {
    return jsonError(error);
  }
}
