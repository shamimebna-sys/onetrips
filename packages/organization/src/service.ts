import { prisma } from "@onetrips/database";
import type { OrgUserRole, OrganizationStatus } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { hashPassword } from "@onetrips/auth";
import { getWalletSnapshot } from "@onetrips/finance";
import { createBranchSchema, inviteMemberSchema, updateOrgStatusSchema, updateOrganizationSchema } from "./schemas";

export async function getMembership(userId: string) {
  const membership = await prisma.organizationUser.findFirst({
    where: { userId },
    include: {
      organization: true,
      branch: true,
      user: { select: { id: true, email: true, displayName: true } },
    },
  });
  if (!membership || membership.organization.deletedAt) {
    throw new DomainError("ORG_NOT_FOUND", "No agency is linked to this account.", 404);
  }
  return membership;
}

export async function requireActiveOrganization(userId: string) {
  const membership = await getMembership(userId);
  if (membership.organization.status !== "ACTIVE") {
    throw new DomainError("ORG_INACTIVE", "Agency is not active for booking.", 403);
  }
  return membership;
}

function toOrgView(
  org: {
    id: string;
    name: string;
    type: string;
    status: OrganizationStatus;
    creditLimit: { toString(): string } | number;
    country: string | null;
    city: string | null;
    createdAt: Date;
  },
  role: OrgUserRole,
) {
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    status: org.status,
    creditLimit: Number(org.creditLimit),
    country: org.country,
    city: org.city,
    createdAt: org.createdAt.toISOString(),
    role,
  };
}

export async function getWorkspace(userId: string) {
  const membership = await getMembership(userId);
  const wallet = await getWalletSnapshot(membership.organizationId, "ORGANIZATION");
  return {
    organization: toOrgView(membership.organization, membership.role),
    membership: {
      id: membership.id,
      role: membership.role,
      branchId: membership.branchId,
      branchName: membership.branch?.name ?? null,
    },
    wallet,
  };
}

export async function updateOrganization(userId: string, input: unknown) {
  const membership = await getMembership(userId);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only owners and admins can update the agency.", 403);
  }
  const data = updateOrganizationSchema.parse(input);
  const organization = await prisma.organization.update({
    where: { id: membership.organizationId },
    data,
  });
  return toOrgView(organization, membership.role);
}

export async function listMembers(userId: string) {
  const membership = await getMembership(userId);
  const rows = await prisma.organizationUser.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: { select: { id: true, email: true, displayName: true, status: true } }, branch: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    displayName: row.user.displayName,
    status: row.user.status,
    role: row.role,
    branchName: row.branch?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function inviteMember(userId: string, input: unknown) {
  const membership = await getMembership(userId);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only owners and admins can invite staff.", 403);
  }
  if (membership.organization.status !== "ACTIVE") {
    throw new DomainError("ORG_INACTIVE", "Activate the agency before inviting staff.");
  }
  const data = inviteMemberSchema.parse(input);
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.type && existing.type !== "B2B") {
    throw new DomainError("ACCOUNT_EXISTS", "That email belongs to a non-agency account.", 409);
  }

  const user = existing
    ? existing
    : await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(data.password),
          displayName: data.displayName,
          type: "B2B",
          status: "ACTIVE",
        },
      });

  try {
    await prisma.organizationUser.create({
      data: {
        organizationId: membership.organizationId,
        userId: user.id,
        role: data.role,
      },
    });
  } catch {
    throw new DomainError("ALREADY_MEMBER", "This person is already on the agency.", 409);
  }

  const role = await prisma.role.findUnique({ where: { name: `B2B_${data.role}` } });
  if (role) {
    const already = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id, organizationId: membership.organizationId },
    });
    if (!already) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id, organizationId: membership.organizationId },
      });
    }
  }

  return listMembers(userId);
}

export async function listBranches(userId: string) {
  const membership = await getMembership(userId);
  return prisma.organizationBranch.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { name: "asc" },
  });
}

export async function createBranch(userId: string, input: unknown) {
  const membership = await getMembership(userId);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only owners and admins can add branches.", 403);
  }
  const data = createBranchSchema.parse(input);
  return prisma.organizationBranch.create({
    data: {
      organizationId: membership.organizationId,
      name: data.name,
      address: data.address,
    },
  });
}

export async function listOrganizations(status?: OrganizationStatus) {
  const rows = await prisma.organization.findMany({
    where: { deletedAt: null, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { users: true, bookings: true } } },
  });
  const views = [];
  for (const org of rows) {
    const wallet = await getWalletSnapshot(org.id, "ORGANIZATION");
    views.push({
      ...toOrgView(org, "OWNER"),
      memberCount: org._count.users,
      bookingCount: org._count.bookings,
      wallet,
    });
  }
  return views;
}

export async function getOrganizationAdmin(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: { include: { user: { select: { id: true, email: true, displayName: true, status: true } } } },
    },
  });
  if (!org || org.deletedAt) throw new DomainError("ORG_NOT_FOUND", "Organization not found.", 404);
  const wallet = await getWalletSnapshot(org.id, "ORGANIZATION");
  return {
    organization: toOrgView(org, "OWNER"),
    members: org.users.map((row) => ({
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      displayName: row.user.displayName,
      status: row.user.status,
      role: row.role,
    })),
    wallet,
  };
}

export async function setOrganizationStatus(organizationId: string, input: unknown) {
  const data = updateOrgStatusSchema.parse(input);
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.deletedAt) throw new DomainError("ORG_NOT_FOUND", "Organization not found.", 404);
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { status: data.status },
  });
  return getOrganizationAdmin(updated.id);
}
