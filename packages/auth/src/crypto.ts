import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string, destination: string): string {
  return createHash("sha256").update(`${destination}:${code}`).digest("hex");
}

export function otpMatches(code: string, destination: string, storedHash: string): boolean {
  const computed = Buffer.from(hashOtp(code, destination));
  const stored = Buffer.from(storedHash);
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
