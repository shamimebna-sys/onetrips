import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { copyOffsite, verifyDumpArchive, writeBackupSidecars } from "./backup-integrity.mjs";
import {
  commandExists,
  dockerPostgresContainer,
  findPostgresBin,
  loadEnvFile,
  parseDatabaseUrl,
  pgEnv,
  repoRoot,
  stamp,
} from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

function fail(message) {
  console.error(`[backup] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[backup] ${message}`);
}

export async function dumpToFile(target, outfile) {
  const container = await dockerPostgresContainer();
  const localDump = findPostgresBin("pg_dump");
  const localExists = localDump !== "pg_dump" || (await commandExists("pg_dump"));
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(target.host);

  if (container && (!localExists || localHost)) {
    log(`Dumping via docker exec ${container}.`);
    return pipeDump(
      "docker",
      [
        "exec",
        "-e",
        `PGPASSWORD=${target.password}`,
        container,
        "pg_dump",
        "--format=custom",
        "--compress=9",
        "--no-owner",
        "--no-acl",
        `--username=${target.user}`,
        target.database,
      ],
      outfile,
    );
  }

  if (!localExists) {
    throw new Error("pg_dump is not installed. Install PostgreSQL client tools or run the database in Docker.");
  }

  log("Dumping via local pg_dump.");
  return pipeDump(
    localDump,
    [
      "--format=custom",
      "--compress=9",
      "--no-owner",
      "--no-acl",
      `--host=${target.host}`,
      `--port=${target.port}`,
      `--username=${target.user}`,
      `--dbname=${target.database}`,
    ],
    outfile,
    { env: pgEnv(target) },
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
        reject(new Error(`pg_dump exited ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
        return;
      }
      resolvePromise({ ok: true });
    });
  });
  await pipeline(child.stdout, createWriteStream(outfile));
  await exit;
}

function applyRetention(dir, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const deleted = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("onetrips-")) continue;
    if (!name.endsWith(".dump") && !name.endsWith(".dump.sha256") && !name.endsWith(".dump.manifest.json")) continue;
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
  const outfile = join(backupDir, `onetrips-${stamp()}.dump`);
  try {
    await dumpToFile(target, outfile);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!existsSync(outfile)) fail(`Backup file missing: ${outfile}`);
  const size = statSync(outfile).size;
  if (size < 64) fail(`Backup file is empty or too small (${size} bytes).`);
  const manifest = writeBackupSidecars(outfile, target);
  log(`Checksum sha256=${manifest.sha256} file=${outfile} size=${size} bytes duration=${Date.now() - started}ms`);
  try {
    await verifyDumpArchive(outfile);
    log("Archive listing verified (pg_restore --list).");
    const offsite = await copyOffsite(outfile, log);
    if (offsite.copied) log("Offsite copy completed.");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }
  const deleted = applyRetention(backupDir, retentionDays);
  log(`Deleted old backups: ${deleted.length ? deleted.join(", ") : "(none)"}`);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
