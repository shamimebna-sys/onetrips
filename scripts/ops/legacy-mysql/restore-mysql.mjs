import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { commandExists, dockerMysqlContainer, loadEnvFile, parseDatabaseUrl, repoRoot, run } from "./backup-mysql.mjs";

loadEnvFile(join(repoRoot, ".env"));

function fail(message) {
  console.error(`[restore] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[restore] ${message}`);
}

async function mysqlExec(target, sql, database) {
  const container = await dockerMysqlContainer();
  const localMysql = await commandExists("mysql");
  const argsFor = (binPrefix) => [
    ...binPrefix,
    `--user=${target.user}`,
    database ? database : "",
    "-e",
    sql,
  ].filter(Boolean);

  if (container) {
    return run("docker", [
      "exec",
      "-e",
      `MYSQL_PWD=${target.password}`,
      container,
      "mysql",
      `--user=${target.user}`,
      ...(database ? [database] : []),
      "-e",
      sql,
    ]);
  }
  if (!localMysql) throw new Error("mysql client not found and no Docker MySQL container is running.");
  return run(
    "mysql",
    [`--host=${target.host}`, `--port=${target.port}`, `--user=${target.user}`, ...(database ? [database] : []), "-e", sql],
    { env: { ...process.env, MYSQL_PWD: target.password } },
  );
}

async function mysqlImport(target, database, sqlBytes) {
  const container = await dockerMysqlContainer();
  if (container) {
    return run(
      "docker",
      ["exec", "-i", "-e", `MYSQL_PWD=${target.password}`, container, "mysql", `--user=${target.user}`, database],
      { stdin: sqlBytes },
    );
  }
  if (!(await commandExists("mysql"))) throw new Error("mysql client not found and no Docker MySQL container is running.");
  return run(
    "mysql",
    [`--host=${target.host}`, `--port=${target.port}`, `--user=${target.user}`, database],
    { env: { ...process.env, MYSQL_PWD: target.password }, stdin: sqlBytes },
  );
}

export async function restoreBackup({ file, database, confirmEnv = "RESTORE_DATABASE" }) {
  if (process.env[confirmEnv] !== "YES") {
    throw new Error(`${confirmEnv}=YES is required before restoring. This prevents accidental production overwrite.`);
  }
  if (!file || !existsSync(file)) throw new Error(`Backup file not found: ${file}`);
  const target = parseDatabaseUrl(process.env.DATABASE_URL);
  const dbName = database || process.env.RESTORE_DB_NAME || target.database;
  log(`Restoring ${file} into ${target.user}@${target.host}:${target.port}/${dbName}`);
  const raw = readFileSync(file);
  const sql = file.endsWith(".gz") ? gunzipSync(raw) : raw;
  if (sql.length < 64) throw new Error("Decompressed dump is empty.");
  await mysqlImport(target, dbName, sql);
  log("Restore completed.");
  return { database: dbName, bytes: sql.length };
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

export { mysqlExec, mysqlImport };
