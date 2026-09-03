import jwt from "jsonwebtoken";

export type AccessTokenPayload = {
  sub: string;
  email?: string;
  type: "CUSTOMER" | "B2B" | "ADMIN";
  permissions: string[];
};

const PLACEHOLDER = /replace-with|changeme|dev-only|onetrips-dev/i;

export function requireJwtSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET", fallback: string): string {
  const value = (process.env[name] || process.env.JWT_SECRET || "").trim();
  if (process.env.NODE_ENV === "production") {
    if (!value || value.length < 32 || PLACEHOLDER.test(value)) {
      throw new Error(`${name} or JWT_SECRET must be a strong production secret (32+ characters, not an example placeholder).`);
    }
    return value;
  }
  if (value.length >= 16 && !PLACEHOLDER.test(value)) return value;
  return fallback;
}

const accessSecret = () => requireJwtSecret("JWT_ACCESS_SECRET", "dev-access-secret");
const refreshSecret = () => requireJwtSecret("JWT_REFRESH_SECRET", "dev-refresh-secret");

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: "15m" });
}

export function signRefreshToken(payload: { sub: string; sid: string }): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, accessSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string; sid: string } {
  return jwt.verify(token, refreshSecret()) as { sub: string; sid: string };
}
