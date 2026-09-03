import { assertApplicationDatabaseUrl } from "@onetrips/database/assert-url";

const PLACEHOLDER = /replace-with|changeme|dev-only|onetrips-dev|password123|secret123/i;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set in production.`);
  if (PLACEHOLDER.test(value)) throw new Error(`${name} still looks like a placeholder. Set a real production secret.`);
  return value;
}

function isWeakSecret(value: string) {
  return value.length < 32 || PLACEHOLDER.test(value);
}

/**
 * Always reject MySQL application URLs. OT_ALLOW_DEV_SECRETS cannot switch production back to MySQL.
 */
export function assertPostgresDatabaseUrl(url = process.env.DATABASE_URL) {
  assertApplicationDatabaseUrl(url, {
    required: process.env.NODE_ENV === "production",
    production: process.env.NODE_ENV === "production",
  });
}

/** Fail fast when the process is started as a production server with unsafe config. */
export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const access = required("JWT_ACCESS_SECRET");
  const refresh = process.env.JWT_REFRESH_SECRET?.trim() || required("JWT_SECRET");
  if (isWeakSecret(access) || isWeakSecret(refresh)) {
    throw new Error("JWT secrets must be at least 32 characters and must not use example placeholders.");
  }
  if (access === refresh) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.");
  }

  const encryption = required("ENCRYPTION_KEY");
  if (!/^[0-9a-fA-F]{64}$/.test(encryption)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string in production.");
  }

  const webhook = required("PAYMENT_WEBHOOK_SECRET");
  if (isWeakSecret(webhook)) {
    throw new Error("PAYMENT_WEBHOOK_SECRET must be at least 32 characters in production.");
  }

  required("DATABASE_URL");
  assertApplicationDatabaseUrl(process.env.DATABASE_URL, { required: true, production: true });
  required("REDIS_URL");

  const flight = (process.env.FLIGHT_PROVIDER ?? "mock").trim().toLowerCase();
  if (flight !== "mock") {
    throw new Error("FLIGHT_PROVIDER must remain mock until a real GDS adapter exists. Do not set live GDS credentials.");
  }
  const hotel = (process.env.HOTEL_PROVIDER ?? "mock").trim().toLowerCase();
  if (hotel !== "mock") {
    throw new Error("HOTEL_PROVIDER must remain mock until a real hotel adapter exists. Do not set live hotel API keys.");
  }
}

export function assertProductionEnvSafe() {
  try {
    assertProductionEnv();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Invalid production environment." };
  }
}
