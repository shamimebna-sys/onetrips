import { prisma } from "@onetrips/database";
import type { UserStatus } from "@onetrips/database";
import { PLATFORM_ROLES, type PlatformRole } from "@onetrips/shared";
import { AuthError } from "./errors";
import { hashPassword } from "./passwords";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().max(64).optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(120),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
  role: z.enum(PLATFORM_ROLES).default("OPERATIONS"),
});

function viewUser(row: {
  id: string;
  email: string | null;
  displayName: string | null;
  status: UserStatus;
  type: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: Array<{ role: { name: string; scope: string } }>;
}) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    type: row.type,
    roles: row.roles.map((item) => item.role.name),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function actorIsSuperAdmin(actorId: string) {
  const rows = await prisma.userRole.findMany({
    where: { userId: actorId },
    include: { role: true },
  });
  return rows.some((row) => row.role.name === "SUPER_ADMIN");
}

async function countSuperAdmins() {
  return prisma.userRole.count({
    where: { role: { name: "SUPER_ADMIN" }, user: { deletedAt: null, status: { not: "DISABLED" } } },
  });
}

export async function listPlatformUsers(input: unknown = {}) {
  const data = querySchema.parse(input ?? {});
  const q = data.q || undefined;
  const rows = await prisma.user.findMany({
    where: {
      type: "ADMIN",
      deletedAt: null,
      ...(data.status ? { status: data.status } : {}),
      ...(q
        ? {
            OR: [{ email: { contains: q } }, { displayName: { contains: q } }],
          }
        : {}),
    },
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
    take: data.take ?? 80,
  });
  return rows.map(viewUser);
}

export async function createPlatformUser(input: unknown, actorId: string) {
  const data = createSchema.parse(input);
  if (data.role === "SUPER_ADMIN" && !(await actorIsSuperAdmin(actorId))) {
    throw new AuthError("FORBIDDEN", "Only a Super Admin can create another Super Admin.", 403);
  }
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AuthError("EMAIL_TAKEN", "That email is already registered.", 409);
  const role = await prisma.role.findUnique({ where: { name: data.role } });
  if (!role || role.scope !== "PLATFORM") throw new AuthError("ROLE_MISSING", "Platform role is not seeded.", 500);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        displayName: data.displayName,
        passwordHash: await hashPassword(data.password),
        type: "ADMIN",
        status: "ACTIVE",
      },
    });
    await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
    await tx.auditLog.create({
      data: {
        actorId,
        actorType: "ADMIN",
        action: "ADMIN_USER_CREATE",
        entityType: "User",
        entityId: created.id,
        newState: { email, role: data.role },
      },
    });
    return created;
  });
  const loaded = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { roles: { include: { role: true } } },
  });
  return viewUser(loaded);
}

export async function setPlatformUserStatus(userId: string, status: UserStatus, actorId: string) {
  if (userId === actorId) throw new AuthError("FORBIDDEN", "You cannot change your own status.", 403);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user || user.type !== "ADMIN" || user.deletedAt) {
    throw new AuthError("USER_NOT_FOUND", "Admin user not found.", 404);
  }
  const isSuper = user.roles.some((row) => row.role.name === "SUPER_ADMIN");
  if (isSuper && (status === "SUSPENDED" || status === "DISABLED") && (await countSuperAdmins()) <= 1) {
    throw new AuthError("LAST_SUPER_ADMIN", "Cannot disable the last Super Admin.", 409);
  }
  await prisma.user.update({ where: { id: userId }, data: { status } });
  await prisma.auditLog.create({
    data: {
      actorId,
      actorType: "ADMIN",
      action: "ADMIN_USER_STATUS",
      entityType: "User",
      entityId: userId,
      previousState: { status: user.status },
      newState: { status },
    },
  });
  const loaded = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  return viewUser(loaded);
}

export async function setPlatformUserRole(userId: string, roleName: PlatformRole, actorId: string) {
  if (roleName === "SUPER_ADMIN" && !(await actorIsSuperAdmin(actorId))) {
    throw new AuthError("FORBIDDEN", "Only a Super Admin can assign Super Admin.", 403);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user || user.type !== "ADMIN" || user.deletedAt) {
    throw new AuthError("USER_NOT_FOUND", "Admin user not found.", 404);
  }
  const nextRole = await prisma.role.findUnique({ where: { name: roleName } });
  if (!nextRole || nextRole.scope !== "PLATFORM") throw new AuthError("ROLE_MISSING", "Platform role is not seeded.", 500);
  const wasSuper = user.roles.some((row) => row.role.name === "SUPER_ADMIN");
  if (wasSuper && roleName !== "SUPER_ADMIN" && (await countSuperAdmins()) <= 1) {
    throw new AuthError("LAST_SUPER_ADMIN", "Cannot demote the last Super Admin.", 409);
  }
  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId, organizationId: null } });
    await tx.userRole.create({ data: { userId, roleId: nextRole.id } });
    await tx.auditLog.create({
      data: {
        actorId,
        actorType: "ADMIN",
        action: "ADMIN_USER_ROLE",
        entityType: "User",
        entityId: userId,
        previousState: { roles: user.roles.map((row) => row.role.name) },
        newState: { role: roleName },
      },
    });
  });
  const loaded = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  return viewUser(loaded);
}
