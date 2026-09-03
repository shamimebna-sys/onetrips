import { prisma } from "@onetrips/database";
import { enqueueNotification } from "@onetrips/notifications";
import { DomainError } from "@onetrips/shared";
import { createSupportRequestSchema, supportReplySchema, supportStatusSchema } from "./schemas";

export async function listSupportRequests(userId: string) {
  return prisma.supportRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
}

export async function createSupportRequest(userId: string, input: unknown) {
  const data = createSupportRequestSchema.parse(input);
  if (data.bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking || booking.userId !== userId || booking.organizationId) {
      throw new DomainError("FORBIDDEN", "You cannot open support on this booking.", 403);
    }
  }

  const created = await prisma.supportRequest.create({
    data: {
      userId,
      bookingId: data.bookingId,
      category: data.category,
      subject: data.subject,
      message: data.message,
      messages: {
        create: { actorId: userId, actorType: "CUSTOMER", body: data.message },
      },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.email) {
    await enqueueNotification(
      {
        channel: "EMAIL",
        recipient: user.email,
        template: "SUPPORT_ACK",
        payload: { subject: data.subject, requestId: created.id },
      },
      userId,
    );
  }

  return created;
}

export async function listSupportQueue(status?: string) {
  return prisma.supportRequest.findMany({
    where: status ? { status: supportStatusSchema.parse(status) } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, displayName: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 30 },
    },
  });
}

export async function updateSupportRequest(id: string, input: unknown, actorId: string) {
  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) throw new DomainError("SUPPORT_NOT_FOUND", "Support request not found.", 404);
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const status = body.status ? supportStatusSchema.parse(body.status) : undefined;
  const reply = body.body ? supportReplySchema.parse({ body: body.body }).body : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    if (reply) {
      await tx.supportMessage.create({
        data: { requestId: id, actorId, actorType: "ADMIN", body: reply },
      });
    }
    return tx.supportRequest.update({
      where: { id },
      data: { status: status ?? (reply ? "PENDING" : existing.status) },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  });

  const customer = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (customer?.email && (reply || status === "RESOLVED" || status === "CLOSED")) {
    await enqueueNotification(
      {
        channel: "EMAIL",
        recipient: customer.email,
        template: "SUPPORT_UPDATE",
        payload: { subject: existing.subject, status: updated.status, requestId: id },
      },
      existing.userId,
    );
  }

  return updated;
}
