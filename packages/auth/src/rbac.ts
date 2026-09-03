import { prisma } from "@onetrips/database";
import { type PermissionCode } from "@onetrips/shared";
import { AuthError } from "./errors";
import type { AccessTokenPayload } from "./tokens";

export async function loadPermissions(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  const codes = new Set<string>();
  for (const assignment of userRoles) {
    for (const link of assignment.role.permissions) {
      codes.add(link.permission.code);
    }
  }
  return [...codes];
}

export function assertPermission(
  payload: AccessTokenPayload,
  required: PermissionCode,
): void {
  if (!payload.permissions.includes(required)) {
    throw new AuthError("FORBIDDEN", "You do not have permission for this action.", 403);
  }
}

export { hasPermission, hasAnyPermission } from "./permissions";
