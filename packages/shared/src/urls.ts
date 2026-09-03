/** Same-origin path only. Rejects protocol-relative, absolute, and encoded tricks. */
export function isSafeReturnPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("://")) return false;
  try {
    const parsed = new URL(value, "https://onetrips.invalid");
    return parsed.origin === "https://onetrips.invalid";
  } catch {
    return false;
  }
}

export function safeReturnPath(value: string | null | undefined, fallback = "/account") {
  return isSafeReturnPath(value) ? value : fallback;
}
