import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { dumpToFile } from "./backup-postgres.mjs";
import { verifyDumpArchive, writeBackupSidecars } from "./backup-integrity.mjs";
import { dropDatabase, ensureDatabase, pgRestoreFile } from "./restore-postgres.mjs";
import { loadEnvFile, parseDatabaseUrl, replaceDatabaseName, repoRoot, stamp } from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

function fail(message) {
  console.error(`[restore-drill] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[restore-drill] ${message}`);
}

async function main() {
  const target = parseDatabaseUrl(process.env.DATABASE_URL);
  const backupDir = resolve(process.env.BACKUP_DIR || join(repoRoot, "backups"));
  const drillDb = process.env.RESTORE_DRILL_DB || "onetrips_restore_drill";
  if (drillDb === target.database) {
    fail("RESTORE_DRILL_DB must not be the production database name.");
  }

  mkdirSync(backupDir, { recursive: true });
  log("1. Create backup");
  const outfile = join(backupDir, `onetrips-drill-${stamp()}.dump`);
  await dumpToFile(target, outfile);
  if (!existsSync(outfile) || statSync(outfile).size < 64) fail("Backup did not produce a usable file.");
  const manifest = writeBackupSidecars(outfile, target);
  await verifyDumpArchive(outfile);
  log(`Backup ${outfile} (${statSync(outfile).size} bytes sha256=${manifest.sha256})`);

  log("2. Prepare temporary database");
  await dropDatabase(target, drillDb);
  await ensureDatabase(target, drillDb);

  log("3. Restore backup");
  await pgRestoreFile(target, drillDb, outfile);

  log("4. Prisma/schema verification via readable tables");
  const drillUrl = replaceDatabaseName(process.env.DATABASE_URL, drillDb);
  const prisma = new PrismaClient({ datasources: { db: { url: drillUrl } } });
  try {
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
      refunds: await prisma.booking.count({ where: { status: { in: ["REFUNDED", "REFUND_PENDING"] } } }),
      audit: await prisma.auditLog.count(),
    };
    log(`5. Record counts ${JSON.stringify(counts)}`);
    if (counts.airports < 1 || counts.airlines < 1) {
      fail("Restored catalog is empty; relationships cannot be verified.");
    }
    const airport = await prisma.airport.findFirst({ include: { city: { include: { country: true } } } });
    if (!airport?.city?.country) fail("Airport → city → country relationship missing.");
    const booking = await prisma.booking.findFirst({
      include: { passengers: true, segments: true, payments: true, tickets: true, invoices: true },
    });
    if (booking) {
      log(`Sample booking ${booking.bookingRef} passengers=${booking.passengers.length} segments=${booking.segments.length}`);
    }
    log("6. Relationships exist (catalog verified; booking relations loaded when present).");
    log("SUCCESS restore drill completed.");
  } finally {
    await prisma.$disconnect();
    if (process.env.RESTORE_DRILL_KEEP !== "YES") {
      await dropDatabase(target, drillDb);
      log(`Dropped disposable database ${drillDb}`);
    }
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
