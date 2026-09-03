import { prisma } from "@onetrips/database";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().max(64).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export async function listAuditLogs(input: unknown = {}) {
  const data = querySchema.parse(input ?? {});
  const q = data.q || undefined;
  const rows = await prisma.auditLog.findMany({
    where: q
      ? {
          OR: [
            { action: { contains: q } },
            { entityType: { contains: q } },
            { entityId: { contains: q } },
            { actorType: { contains: q } },
          ],
        }
      : undefined,
    include: { actor: { select: { email: true, displayName: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take: data.take ?? 80,
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorType: row.actorType,
    actorId: row.actorId,
    actorEmail: row.actor?.email ?? null,
    actorName: row.actor?.displayName ?? null,
    reason: row.reason,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  }));
}
