import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../..");

const PG_BIN_CANDIDATES = [
  "C:\\Program Files\\PostgreSQL\\18\\bin",
  "C:\\Program Files\\PostgreSQL\\16\\bin",
  "C:\\Program Files\\PostgreSQL\\15\\bin",
  "/usr/lib/postgresql/16/bin",
  "/usr/bin",
];

export function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(repoRoot, ".env"));

export function parseDatabaseUrl(url, defaultPort = "5432") {
  if (!url) throw new Error("DATABASE_URL is required.");
  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(":", "").toLowerCase();
  if (protocol !== "postgresql" && protocol !== "postgres") {
    throw new Error(`DATABASE_URL must be a postgresql:// URL (got ${protocol}).`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("?")[0];
  if (!database) throw new Error("DATABASE_URL must include a database name.");
  return {
    protocol,
    host: parsed.hostname,
    port: parsed.port || defaultPort,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    url,
  };
}

export function replaceDatabaseName(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const { stdin, stdinBuf, env, ...rest } = options;
    const child = spawn(command, args, {
      ...rest,
      env: env || process.env,
      windowsHide: true,
      stdio: stdin || stdinBuf ? ["pipe", "pipe", "pipe"] : undefined,
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    if (stdin || stdinBuf) {
      child.stdin.write(stdinBuf || stdin);
      child.stdin.end();
    }
    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout = Buffer.concat([stdout, chunk]);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr = Buffer.concat([stderr, chunk]);
      });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      const err = stderr.toString("utf8");
      if (code === 0) resolvePromise({ stdout: stdout.toString("utf8"), stderr: err, code, stdoutBuf: stdout });
      else reject(new Error(`${command} exited ${code}${err ? `: ${err.trim()}` : ""}`));
    });
  });
}

export async function commandExists(name) {
  try {
    await run(process.platform === "win32" ? "where" : "which", [name]);
    return true;
  } catch {
    return false;
  }
}

export function findPostgresBin(binary) {
  const exe = process.platform === "win32" && !binary.endsWith(".exe") ? `${binary}.exe` : binary;
  for (const dir of PG_BIN_CANDIDATES) {
    const full = join(dir, exe);
    if (existsSync(full)) return full;
  }
  return binary;
}

export async function dockerPostgresContainer() {
  try {
    const { stdout } = await run("docker", ["ps", "--format", "{{.Names}}"]);
    const names = stdout.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    return names.find((name) => name === "onetrips-postgres") || names.find((name) => name.includes("postgres")) || null;
  } catch {
    return null;
  }
}

export function pgEnv(target) {
  return {
    ...process.env,
    PGHOST: target.host,
    PGPORT: String(target.port),
    PGUSER: target.user,
    PGPASSWORD: target.password,
    PGDATABASE: target.database,
  };
}
