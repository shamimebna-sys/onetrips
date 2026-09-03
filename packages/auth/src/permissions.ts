import type { PermissionCode } from "@onetrips/shared";

export function hasPermission(
  granted: readonly string[],
  required: PermissionCode,
): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(
  granted: readonly string[],
  required: readonly PermissionCode[],
): boolean {
  return required.some((permission) => granted.includes(permission));
}
