const MYSQL_PROTOCOLS = new Set(["mysql", "mysql2"]);
const POSTGRES_PROTOCOLS = new Set(["postgresql", "postgres"]);

const PRODUCTION_MESSAGE = "PostgreSQL is required for production.";

export function databaseUrlProtocol(url: string): string {
  return new URL(url).protocol.replace(":", "").toLowerCase();
}

/** Reject MySQL (and any non-Postgres) application DATABASE_URL. Never a silent fallback. */
export function assertApplicationDatabaseUrl(
  url: string | undefined,
  options?: { required?: boolean; production?: boolean },
) {
  const production = options?.production ?? process.env.NODE_ENV === "production";
  const required = options?.required ?? production;
  const value = url?.trim() ?? "";
  if (!value) {
    if (required) throw new Error(PRODUCTION_MESSAGE);
    return;
  }
  let protocol: string;
  try {
    protocol = databaseUrlProtocol(value);
  } catch {
    throw new Error(production ? PRODUCTION_MESSAGE : "DATABASE_URL is not a valid URL.");
  }
  if (MYSQL_PROTOCOLS.has(protocol) || !POSTGRES_PROTOCOLS.has(protocol)) {
    throw new Error(PRODUCTION_MESSAGE);
  }
}
