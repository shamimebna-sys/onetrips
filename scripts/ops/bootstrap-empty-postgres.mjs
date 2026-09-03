/**
 * Empty PostgreSQL bootstrap test.
 *
 * Creates a disposable database, applies Prisma migrations, seeds, and verifies
 * schema objects. Does not use MySQL or mysql2.
 *
 * Never mutates the live DATABASE_URL database.
 */
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { dropDatabase, ensureDatabase, pgExec } from "./restore-postgres.mjs";
import { loadEnvFile, parseDatabaseUrl, replaceDatabaseName, repoRoot } from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

const REQUIRED_TABLES = [
  "Agent",
  "User",
  "Role",
  "Permission",
  "Customer",
  "Organization",
  "OrganizationUser",
  "Country",
  "City",
  "Airport",
  "Airline",
  "Supplier",
  "Booking",
  "BookingPassenger",
  "BookingSegment",
  "BookingStatusHistory",
  "ProviderOperation",
  "Payment",
  "Wallet",
  "LedgerEntry",
  "Invoice",
  "InvoiceItem",
  "Ticket",
  "NotificationLog",
  "AuditLog",
];

function fail(message) {
  console.error(`[bootstrap] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[bootstrap] ${message}`);
}

function run(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function main() {
  const live = parseDatabaseUrl(process.env.DATABASE_URL);
  const emptyName = process.env.EMPTY_BOOTSTRAP_DB || "onetrips_empty_bootstrap";
  if (emptyName === live.database) {
    fail("EMPTY_BOOTSTRAP_DB must not be the live database name.");
  }
  const emptyUrl = replaceDatabaseName(process.env.DATABASE_URL, emptyName);
  parseDatabaseUrl(emptyUrl);

  log(`Live database ${live.database} will not be modified.`);
  log(`Disposable PostgreSQL ${emptyName}`);

  await dropDatabase(live, emptyName);
  await ensureDatabase(live, emptyName);

  const childEnv = { ...process.env, DATABASE_URL: emptyUrl };
  delete childEnv.MYSQL_DATABASE_URL;

  log("1. prisma validate");
  await run("npx", ["prisma", "validate", "--schema", "packages/database/prisma/schema.prisma"], childEnv);
  log("2. prisma generate");
  await run("npx", ["prisma", "generate", "--schema", "packages/database/prisma/schema.prisma"], childEnv);
  log("3. prisma migrate deploy");
  await run("npm", ["run", "db:migrate:deploy"], childEnv);
  log("4. prisma db seed");
  await run("npm", ["run", "db:seed"], childEnv);

  const prisma = new PrismaClient({ datasources: { db: { url: emptyUrl } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    const admin = process.env.POSTGRES_ADMIN_URL
      ? parseDatabaseUrl(process.env.POSTGRES_ADMIN_URL)
      : live;
    const tables = await pgExec(
      admin,
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`,
      emptyName,
    );
    log(`Public tables ${tables.stdout.replace(/\s+/g, " ").trim()}`);

    const missing = [];
    for (const name of REQUIRED_TABLES) {
      const count = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS n
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${name}
      `;
      if (!count[0]?.n) missing.push(name);
    }
    if (missing.length) fail(`Missing tables: ${missing.join(", ")}`);

    const fks = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
    `;
    const indexes = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname = 'public'
    `;
    const checks = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM information_schema.table_constraints
      WHERE constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK') AND table_schema = 'public'
    `;
    log(`Foreign keys=${fks[0].n} indexes=${indexes[0].n} keys/checks=${checks[0].n}`);
    if (fks[0].n < 10 || indexes[0].n < 10) fail("Schema is missing relations or indexes.");

    const airport = await prisma.airport.findFirst({ include: { city: { include: { country: true } } } });
    if (!airport?.city?.country) fail("Seed did not create airport → city → country.");
    if ((await prisma.airline.count()) < 1) fail("Seed did not create airlines.");
    if ((await prisma.role.count()) < 1) fail("Seed did not create roles.");
    if ((await prisma.permission.count()) < 1) fail("Seed did not create permissions.");

    const seq = await prisma.$queryRaw`
      SELECT pg_get_serial_sequence('"Agent"', 'id') AS seq
    `;
    if (!seq[0]?.seq) fail("Agent serial sequence is missing.");

    log("SUCCESS empty PostgreSQL database bootstrapped without MySQL.");
  } finally {
    await prisma.$disconnect();
    if (process.env.EMPTY_BOOTSTRAP_KEEP !== "YES") {
      await dropDatabase(live, emptyName);
      log(`Dropped disposable database ${emptyName}`);
    }
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
