import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile, parseDatabaseUrl, repoRoot } from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

function fail(message) {
  console.error(`[accept] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[accept] ${message}`);
}

function runScript(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(repoRoot, "scripts/ops", script)], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

async function main() {
  log("Phase 17 production acceptance");

  let target;
  try {
    target = parseDatabaseUrl(process.env.DATABASE_URL);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }
  log(`PostgreSQL ${target.user}@${target.host}:${target.port}/${target.database}`);

  if (!process.env.REDIS_URL?.trim()) {
    log("WARN REDIS_URL is unset; cache/queue will use in-memory fallbacks. Redis is not the financial source of truth.");
  }

  const flight = (process.env.FLIGHT_PROVIDER ?? "mock").trim().toLowerCase();
  const hotel = (process.env.HOTEL_PROVIDER ?? "mock").trim().toLowerCase();
  if (flight !== "mock" || hotel !== "mock") {
    fail("FLIGHT_PROVIDER and HOTEL_PROVIDER must remain mock. Do not accept a live supplier in this phase.");
  }

  const offsiteDir = process.env.BACKUP_OFFSITE_DIR?.trim();
  const rcloneRemote = process.env.BACKUP_RCLONE_REMOTE?.trim();
  if (!offsiteDir && !rcloneRemote) {
    fail(
      "Offsite backup destination is required for acceptance. Set BACKUP_OFFSITE_DIR to a second disk/mount or BACKUP_RCLONE_REMOTE.",
    );
  }
  process.env.BACKUP_OFFSITE_REQUIRED = "YES";

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const counts = {
      users: await prisma.user.count(),
      organizations: await prisma.organization.count(),
      airports: await prisma.airport.count(),
      airlines: await prisma.airline.count(),
      bookings: await prisma.booking.count(),
      payments: await prisma.payment.count(),
      tickets: await prisma.ticket.count(),
      invoices: await prisma.invoice.count(),
      ledger: await prisma.ledgerEntry.count(),
    };
    log(`Live counts ${JSON.stringify(counts)}`);
    if (counts.airports < 1 || counts.airlines < 1) {
      fail("Catalog is empty. Seed or import data before production acceptance.");
    }
    const airport = await prisma.airport.findFirst({ include: { city: { include: { country: true } } } });
    if (!airport?.city?.country) fail("Airport → city → country relationship missing on the live database.");
  } finally {
    await prisma.$disconnect();
  }

  log("1. Backup + checksum + offsite copy");
  await runScript("backup-postgres.mjs");
  log("2. Verify latest dump");
  await runScript("backup-verify.mjs");
  if (process.env.ACCEPTANCE_SKIP_DRILL === "YES") {
    log("3. Restore drill skipped (ACCEPTANCE_SKIP_DRILL=YES).");
  } else {
    log("3. Restore drill");
    await runScript("restore-drill.mjs");
  }
  log("SUCCESS production acceptance checks passed.");
  log("Public launch still requires real secrets, TLS, and a configured offsite destination in a different failure domain.");
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
