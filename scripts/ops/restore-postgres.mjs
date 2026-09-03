import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commandExists,
  dockerPostgresContainer,
  findPostgresBin,
  loadEnvFile,
  parseDatabaseUrl,
  pgEnv,
  repoRoot,
  run,
} from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

function adminTarget(target) {
  const adminUrl = process.env.POSTGRES_ADMIN_URL;
  if (!adminUrl) return target;
  return parseDatabaseUrl(adminUrl);
}

function fail(message) {
  console.error(`[restore] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[restore] ${message}`);
}

async function pgExec(target, sql, database = target.database) {
  const container = await dockerPostgresContainer();
  if (container) {
    return run("docker", [
      "exec",
      "-e",
      `PGPASSWORD=${target.password}`,
      container,
      "psql",
      `--username=${target.user}`,
      `--dbname=${database}`,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ]);
  }
  const psql = findPostgresBin("psql");
  if (psql === "psql" && !(await commandExists("psql"))) {
    throw new Error("psql is not installed and no Docker PostgreSQL container is running.");
  }
  return run(
    psql,
    [
      `--host=${target.host}`,
      `--port=${target.port}`,
      `--username=${target.user}`,
      `--dbname=${database}`,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { env: { ...pgEnv(target), PGDATABASE: database } },
  );
}

async function pgRestoreFile(target, database, file) {
  const container = await dockerPostgresContainer();
  if (container) {
    const bytes = readFileSync(file);
    return run(
      "docker",
      [
        "exec",
        "-i",
        "-e",
        `PGPASSWORD=${target.password}`,
        container,
        "pg_restore",
        "--no-owner",
        "--no-acl",
        `--username=${target.user}`,
        `--dbname=${database}`,
      ],
      { stdinBuf: bytes },
    );
  }
  const pgRestore = findPostgresBin("pg_restore");
  if (pgRestore === "pg_restore" && !(await commandExists("pg_restore"))) {
    throw new Error("pg_restore is not installed and no Docker PostgreSQL container is running.");
  }
  return run(
    pgRestore,
    [
      "--no-owner",
      "--no-acl",
      `--host=${target.host}`,
      `--port=${target.port}`,
      `--username=${target.user}`,
      `--dbname=${database}`,
      file,
    ],
    { env: { ...pgEnv(target), PGDATABASE: database } },
  );
}

export async function ensureDatabase(target, database) {
  const admin = adminTarget(target);
  const exists = await pgExec(
    admin,
    `SELECT 1 FROM pg_database WHERE datname = '${database.replace(/'/g, "''")}';`,
    "postgres",
  );
  if (!exists.stdout.includes("1")) {
    const owner = target.user.replace(/"/g, '""');
    await pgExec(
      admin,
      `CREATE DATABASE "${database.replace(/"/g, '""')}" OWNER "${owner}";`,
      "postgres",
    );
  }
}

export async function dropDatabase(target, database) {
  await pgExec(adminTarget(target), `DROP DATABASE IF EXISTS "${database.replace(/"/g, '""')}" WITH (FORCE);`, "postgres");
}

export async function restoreBackup({ file, database, confirmEnv = "RESTORE_DATABASE" }) {
  if (process.env[confirmEnv] !== "YES") {
    throw new Error(`${confirmEnv}=YES is required before restoring. This prevents accidental production overwrite.`);
  }
  if (!file || !existsSync(file)) throw new Error(`Backup file not found: ${file}`);
  const target = parseDatabaseUrl(process.env.DATABASE_URL);
  const dbName = database || process.env.RESTORE_DB_NAME || target.database;
  log(`Restoring ${file} into ${target.user}@${target.host}:${target.port}/${dbName}`);
  await ensureDatabase(target, dbName);
  await pgRestoreFile(target, dbName, file);
  log("Restore completed.");
  return { database: dbName };
}

async function main() {
  try {
    const file = process.env.RESTORE_FILE || process.argv[2];
    await restoreBackup({ file, database: process.env.RESTORE_DB_NAME });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main();
}

export { pgExec, pgRestoreFile };
