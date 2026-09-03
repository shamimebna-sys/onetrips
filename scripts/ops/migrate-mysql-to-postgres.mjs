/**
 * LEGACY MIGRATION TOOL — one-time MySQL → PostgreSQL importer.
 *
 * This file is NOT part of the application runtime.
 * mysql2 is required only for this utility.
 *
 * MUST NEVER be imported by apps/, packages/, workers, CI startup, backup, or restore.
 * MUST NEVER run during: npm run dev | build | start | worker
 *
 * Invoke only: npm run db:migrate:mysql
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { Prisma, PrismaClient } from "@prisma/client";
import { loadEnvFile, repoRoot } from "./backup-common.mjs";

loadEnvFile(join(repoRoot, ".env"));

const TABLES = [
  "Agent",
  "Country",
  "City",
  "Airport",
  "Airline",
  "Supplier",
  "User",
  "Role",
  "Permission",
  "Organization",
  "OrganizationBranch",
  "RolePermission",
  "UserRole",
  "OrganizationUser",
  "Customer",
  "SavedPassenger",
  "UserSession",
  "UserLoginHistory",
  "OtpChallenge",
  "FlightSearchSession",
  "HotelSearchSession",
  "Booking",
  "BookingStatusHistory",
  "BookingPassenger",
  "BookingSegment",
  "Ticket",
  "ProviderOperation",
  "Payment",
  "PaymentAttempt",
  "PaymentWebhookEvent",
  "Wallet",
  "LedgerEntry",
  "Invoice",
  "InvoiceItem",
  "MarkupRule",
  "CommissionRule",
  "ServiceFeeRule",
  "NotificationTemplate",
  "NotificationLog",
  "AuditLog",
  "Currency",
  "ExchangeRate",
  "SystemConfig",
  "IdempotencyRecord",
];

function decimalCanon(value) {
  if (value == null) return "0";
  const text = String(value).trim();
  const negative = text.startsWith("-");
  const raw = negative ? text.slice(1) : text;
  if (!/^\d+(\.\d+)?$/.test(raw)) return text;
  const [intPart, frac = ""] = raw.split(".");
  const intDigits = intPart.replace(/^0+(?=\d)/, "") || "0";
  const fracTrim = frac.replace(/0+$/, "");
  const body = fracTrim.length ? `${intDigits}.${fracTrim}` : intDigits;
  return negative && body !== "0" ? `-${body}` : body;
}

function decimalEq(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return decimalCanon(a) === decimalCanon(b);
}

function fail(message) {
  console.error(`[migrate] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[migrate] ${message}`);
}

function assertPostgresUrl(url) {
  if (!url) throw new Error("DATABASE_URL is required (PostgreSQL destination).");
  const protocol = new URL(url).protocol.replace(":", "");
  if (protocol !== "postgresql" && protocol !== "postgres") {
    throw new Error(`DATABASE_URL must be postgresql:// (got ${protocol}).`);
  }
}

function assertMysqlUrl(url) {
  if (!url) throw new Error("MYSQL_DATABASE_URL is required (MySQL source).");
  const protocol = new URL(url).protocol.replace(":", "");
  if (protocol !== "mysql" && protocol !== "mysql2") {
    throw new Error(`MYSQL_DATABASE_URL must be mysql:// (got ${protocol}).`);
  }
}

function modelOf(name) {
  const model = Prisma.dmmf.datamodel.models.find((row) => row.name === name);
  if (!model) throw new Error(`Prisma model ${name} is missing from the schema.`);
  return model;
}

function prismaDelegate(prisma, name) {
  const key = name.slice(0, 1).toLowerCase() + name.slice(1);
  const delegate = prisma[key];
  if (!delegate) throw new Error(`Prisma client has no delegate for ${name}.`);
  return delegate;
}

function rowValue(row, fieldName) {
  if (Object.prototype.hasOwnProperty.call(row, fieldName)) return row[fieldName];
  const found = Object.keys(row).find((key) => key.toLowerCase() === fieldName.toLowerCase());
  return found ? row[found] : undefined;
}

function transformRow(model, row) {
  const out = {};
    const scalars = model.fields.filter((item) => item.kind === "scalar" || item.kind === "enum");
    for (const field of scalars) {
    let value = rowValue(row, field.name);
    if (value === undefined) {
      if (field.isRequired && !field.hasDefaultValue) {
        throw new Error(`${model.name}.${field.name} is required in MySQL row but missing.`);
      }
      continue;
    }
    if (value === null) {
      if (field.isRequired) throw new Error(`${model.name}.${field.name} is required but MySQL value is null.`);
      out[field.name] = null;
      continue;
    }
    if (field.type === "Decimal") value = String(value);
    else if (field.type === "Boolean") value = value === true || value === 1 || value === "1";
    else if (field.type === "Int" || field.type === "Float") value = Number(value);
    else if (field.type === "DateTime") value = value instanceof Date ? value : new Date(value);
    else if (field.type === "Json") {
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          throw new Error(`${model.name}.${field.name} is not valid JSON.`);
        }
      } else if (Buffer.isBuffer(value)) {
        value = JSON.parse(value.toString("utf8"));
      }
    }
    out[field.name] = value;
  }
  return out;
}

async function mysqlCount(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  return Number(rows[0].n);
}

async function mysqlRows(conn, table) {
  const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
  return rows;
}

async function resetAgentSequence(prisma) {
  const rows = await prisma.$queryRaw`SELECT COALESCE(MAX(id), 0)::int AS max FROM "Agent"`;
  const max = Number(rows[0]?.max ?? 0);
  if (max > 0) {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Agent"', 'id'), ${max}, true)`);
  }
}

async function main() {
  const sourceUrl = process.env.MYSQL_DATABASE_URL;
  const destUrl = process.env.DATABASE_URL;
  try {
    assertMysqlUrl(sourceUrl);
    assertPostgresUrl(destUrl);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const source = new URL(sourceUrl);
  const dest = new URL(destUrl);
  log(`Source MySQL ${source.username}@${source.hostname}:${source.port || "3306"}${source.pathname}`);
  log(`Destination PostgreSQL ${dest.username}@${dest.hostname}:${dest.port || "5432"}${dest.pathname}`);
  log("Redis is not migrated.");

  const conn = await mysql.createConnection({
    uri: sourceUrl,
    decimalNumbers: false,
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  const prisma = new PrismaClient({ datasources: { db: { url: destUrl } } });
  const report = {
    startedAt: new Date().toISOString(),
    source: `${source.hostname}${source.pathname}`,
    destination: `${dest.hostname}${dest.pathname}`,
    tables: [],
    mismatches: [],
    transformed: {
      decimals: "copied as strings into Prisma Decimal / NUMERIC",
      json: "MySQL JSON → PostgreSQL JSONB via Prisma Json",
      booleans: "TINYINT(1) → boolean",
      timestamps: "DATETIME(3) → timestamp(3) (UTC instant preserved)",
      ids: "preserved",
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    for (const name of TABLES) {
      const model = modelOf(name);
      const sourceCount = await mysqlCount(conn, name);
      const rows = sourceCount === 0 ? [] : await mysqlRows(conn, name);
      if (rows.length !== sourceCount) {
        throw new Error(`${name}: MySQL COUNT(*)=${sourceCount} but fetched ${rows.length} rows.`);
      }
      const payload = rows.map((row) => transformRow(model, row));
      const delegate = prismaDelegate(prisma, name);
      if (payload.length) {
        const ids = payload.map((row) => row.id).filter((id) => id != null);
        const uniqueIds = new Set(ids.map(String));
        if (uniqueIds.size !== ids.length) {
          throw new Error(`${name}: duplicate IDs in MySQL export.`);
        }
        await delegate.createMany({ data: payload, skipDuplicates: true });
      }
      const destCount = await delegate.count();
      const tableReport = { table: name, mysql: sourceCount, postgres: destCount };
      report.tables.push(tableReport);
      if (sourceCount !== destCount) {
        report.mismatches.push(tableReport);
        throw new Error(`${name}: row count mismatch MySQL=${sourceCount} PostgreSQL=${destCount}`);
      }
      log(`${name}: ${sourceCount} rows`);
    }

    await resetAgentSequence(prisma);

    const mysqlLedger = await conn.query(
      "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM `LedgerEntry`",
    );
    const pgLedger = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, _count: true });
    const mysqlSum = String(mysqlLedger[0][0].total);
    const pgSum = pgLedger._sum.amount == null ? "0" : String(pgLedger._sum.amount);
    report.ledger = { mysqlCount: Number(mysqlLedger[0][0].n), postgresCount: pgLedger._count, mysqlSum, postgresSum: pgSum };
    if (!decimalEq(mysqlSum, pgSum)) {
      throw new Error(`Ledger SUM(amount) mismatch MySQL=${mysqlSum} PostgreSQL=${pgSum}`);
    }

    const mysqlBookings = await mysqlRows(conn, "Booking");
    for (const row of mysqlBookings) {
      const booking = await prisma.booking.findUnique({ where: { id: row.id } });
      if (!booking) throw new Error(`Booking ${row.id} missing after import.`);
      if (booking.bookingRef !== row.bookingRef) throw new Error(`Booking ${row.id} bookingRef mismatch.`);
      if (booking.providerRef !== (row.providerRef ?? null)) throw new Error(`Booking ${row.id} providerRef mismatch.`);
      if (!decimalEq(booking.totalAmount, row.totalAmount)) throw new Error(`Booking ${row.id} totalAmount mismatch.`);
      if (booking.currency !== row.currency) throw new Error(`Booking ${row.id} currency mismatch.`);
      if (booking.status !== row.status) throw new Error(`Booking ${row.id} status mismatch.`);
      if ((booking.organizationId ?? null) !== (row.organizationId ?? null)) throw new Error(`Booking ${row.id} organizationId mismatch.`);
      if ((booking.userId ?? null) !== (row.userId ?? null)) throw new Error(`Booking ${row.id} userId mismatch.`);
    }

    report.finishedAt = new Date().toISOString();
    report.ok = true;
    const reportDir = join(repoRoot, "backups");
    mkdirSync(reportDir, { recursive: true });
    const reportPath = join(reportDir, `mysql-to-postgres-${Date.now()}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    log(`Report ${reportPath}`);
    log("SUCCESS MySQL → PostgreSQL import validated.");
  } catch (error) {
    report.ok = false;
    report.error = error instanceof Error ? error.message : String(error);
    fail(report.error);
  } finally {
    await prisma.$disconnect();
    await conn.end();
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main();
}
