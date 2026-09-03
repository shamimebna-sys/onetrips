import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../..");

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

function fail(message) {
  console.error(`[backup] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[backup] ${message}`);
}

export function parseDatabaseUrl(url) {
  if (!url) throw new Error("DATABASE_URL is required.");
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("?")[0];
  if (!database) throw new Error("DATABASE_URL must include a database name.");
  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const { stdin, ...rest } = options;
    const child = spawn(command, args, { ...rest, windowsHide: true, stdio: stdin ? ["pipe", "pipe", "pipe"] : undefined });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    if (child.stdout) child.stdout.on("data", (chunk) => { stdout = Buffer.concat([stdout, chunk]); });
    if (child.stderr) child.stderr.on("data", (chunk) => { stderr = Buffer.concat([stderr, chunk]); });
    child.on("error", reject);
    child.on("close", (code) => {
      const out = stdout.toString("utf8");
      const err = stderr.toString("utf8");
      if (code === 0) resolvePromise({ stdout: out, stderr: err, code, stdoutBuf: stdout });
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

export async function dockerMysqlContainer() {
  try {
    const { stdout } = await run("docker", ["ps", "--format", "{{.Names}}"]);
    const names = stdout.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    return names.find((name) => name === "onetrips-mysql") || names.find((name) => name.includes("mysql")) || null;
  } catch {
    return null;
  }
}

export async function dumpToFile(target, outfile) {
  const container = await dockerMysqlContainer();
  const localDump = await commandExists("mysqldump");
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(target.host);
  if ((!localDump || localHost) && container) {
    log(`Dumping via docker exec ${container}.`);
    return pipeDump(
      "docker",
      [
        "exec",
        "-e",
        `MYSQL_PWD=${target.password}`,
        container,
        "mysqldump",
        `--user=${target.user}`,
        "--single-transaction",
        "--routines",
        "--triggers",
        "--skip-comments",
        "--default-character-set=utf8mb4",
        target.database,
      ],
      outfile,
    );
  }
  if (!localDump) {
    throw new Error("mysqldump is not installed. Install MySQL client tools or run the database in Docker.");
  }
  log("Dumping via local mysqldump.");
  return pipeDump(
    "mysqldump",
    [
      `--host=${target.host}`,
      `--port=${target.port}`,
      `--user=${target.user}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--skip-comments",
      "--default-character-set=utf8mb4",
      target.database,
    ],
    outfile,
    { env: { ...process.env, MYSQL_PWD: target.password } },
  );
}

async function pipeDump(command, args, outfile, options = {}) {
  const child = spawn(command, args, { ...options, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exit = new Promise((resolvePromise, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`mysqldump exited ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
        return;
      }
      resolvePromise({ ok: true });
    });
  });
  await pipeline(child.stdout, createGzip(), createWriteStream(outfile));
  await exit;
}

function applyRetention(dir, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const deleted = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("onetrips-") || !name.endsWith(".sql.gz")) continue;
    const full = join(dir, name);
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full);
      deleted.push(name);
    }
  }
  return deleted;
}

async function main() {
  const started = Date.now();
  log("Start");
  let target;
  try {
    target = parseDatabaseUrl(process.env.DATABASE_URL);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }
  log(`Database target ${target.user}@${target.host}:${target.port}/${target.database}`);
  const backupDir = resolve(process.env.BACKUP_DIR || join(repoRoot, "backups"));
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) fail("BACKUP_RETENTION_DAYS must be a positive number.");
  mkdirSync(backupDir, { recursive: true });
  const outfile = join(backupDir, `onetrips-${stamp()}.sql.gz`);
  try {
    await dumpToFile(target, outfile);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!existsSync(outfile)) fail(`Backup file missing: ${outfile}`);
  const size = statSync(outfile).size;
  if (size < 64) fail(`Backup file is empty or too small (${size} bytes).`);
  log(`Completion file=${outfile} size=${size} bytes duration=${Date.now() - started}ms`);
  const deleted = applyRetention(backupDir, retentionDays);
  log(`Deleted old backups: ${deleted.length ? deleted.join(", ") : "(none)"}`);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
