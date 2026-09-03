/**
 * LEGACY COMPARISON TOOL — read-only MySQL vs PostgreSQL validation.
 *
 * mysql2 is required only for this one-time cutover check.
 * Never imported by apps, workers, CI startup, backup, or restore.
 * Does not write to MySQL. PostgreSQL writes are limited to disposable test rows
 * that are deleted afterwards.
 *
 * Invoke: npm run db:verify:mysql
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { Prisma, PrismaClient } from "@prisma/client";
import { loadEnvFile, parseDatabaseUrl, repoRoot } from "./backup-common.mjs";

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

function fail(message) {
  console.error(`[verify] FAIL ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[verify] ${message}`);
}

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
  return decimalCanon(a) === decimalCanon(b);
}

function assertMysqlUrl(url) {
  if (!url) throw new Error("MYSQL_DATABASE_URL is required (MySQL source, read-only).");
  const protocol = new URL(url).protocol.replace(":", "");
  if (protocol !== "mysql" && protocol !== "mysql2") {
    throw new Error(`MYSQL_DATABASE_URL must be mysql:// (got ${protocol}).`);
  }
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

async function mysqlCount(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  return Number(rows[0].n);
}

async function mysqlQuery(conn, sql, params) {
  const [rows] = params ? await conn.execute(sql, params) : await conn.query(sql);
  return rows;
}

async function main() {
  const sourceUrl = process.env.MYSQL_DATABASE_URL;
  const destUrl = process.env.DATABASE_URL;
  try {
    assertMysqlUrl(sourceUrl);
    parseDatabaseUrl(destUrl);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const source = new URL(sourceUrl);
  const dest = new URL(destUrl);
  log(`MySQL ${source.hostname}${source.pathname} (read-only)`);
  log(`PostgreSQL ${dest.hostname}${dest.pathname}`);

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
    missingIds: [],
    financial: {},
    orphans: {},
    sequences: {},
    identities: {},
  };

  try {
    await prisma.$queryRaw`SELECT 1`;

    for (const name of TABLES) {
      const mysqlN = await mysqlCount(conn, name);
      const postgresN = await prismaDelegate(prisma, name).count();
      const tableReport = { table: name, mysql: mysqlN, postgres: postgresN };
      report.tables.push(tableReport);
      log(`${name}: mysql=${mysqlN} postgres=${postgresN}`);

      if (mysqlN > postgresN) {
        throw new Error(`${name}: PostgreSQL is missing rows (MySQL=${mysqlN} PostgreSQL=${postgresN}).`);
      }
      if (mysqlN === 0) continue;

      const model = Prisma.dmmf.datamodel.models.find((row) => row.name === name);
      const idField = model?.fields.find((field) => field.isId);
      if (!idField) continue;

      const [idRows] = await conn.query(`SELECT \`${idField.name}\` AS id FROM \`${name}\``);
      const mysqlIds = idRows.map((row) => (idField.type === "Int" ? Number(row.id) : String(row.id)));
      const pgRows = await prismaDelegate(prisma, name).findMany({
        where: { [idField.name]: { in: mysqlIds } },
        select: { [idField.name]: true },
      });
      const pgIds = new Set(pgRows.map((row) => String(row[idField.name])));
      const missing = mysqlIds.filter((id) => !pgIds.has(String(id)));
      if (missing.length) {
        report.missingIds.push({ table: name, ids: missing.slice(0, 20), count: missing.length });
        throw new Error(`${name}: ${missing.length} MySQL ids missing in PostgreSQL.`);
      }
    }

    const mysqlLedger = await mysqlQuery(
      conn,
      `SELECT type, CAST(SUM(amount) AS CHAR) AS total, COUNT(*) AS n FROM \`LedgerEntry\` GROUP BY type`,
    );
    const pgLedger = await prisma.$queryRaw`
      SELECT type::text AS type, SUM(amount)::text AS total, COUNT(*)::int AS n
      FROM "LedgerEntry"
      GROUP BY type
    `;
    const mysqlByType = Object.fromEntries(mysqlLedger.map((row) => [row.type, { total: String(row.total), n: Number(row.n) }]));
    const pgByType = Object.fromEntries(pgLedger.map((row) => [row.type, { total: String(row.total), n: Number(row.n) }]));
    const ledgerTypes = new Set([...Object.keys(mysqlByType), ...Object.keys(pgByType)]);
    const ledgerCompare = {};
    for (const type of ledgerTypes) {
      const mysqlTotal = mysqlByType[type]?.total ?? "0";
      const pgTotal = pgByType[type]?.total ?? "0";
      ledgerCompare[type] = { mysql: mysqlTotal, postgres: pgTotal, mysqlN: mysqlByType[type]?.n ?? 0, postgresN: pgByType[type]?.n ?? 0 };
      if (mysqlByType[type] && !decimalEq(mysqlTotal, pgTotal) && (pgByType[type]?.n ?? 0) < (mysqlByType[type]?.n ?? 0)) {
        throw new Error(`Ledger ${type} total missing in PostgreSQL MySQL=${mysqlTotal} PostgreSQL=${pgTotal}`);
      }
    }

    const mysqlLedgerIds = await mysqlQuery(conn, "SELECT id, type, CAST(amount AS CHAR) AS amount, currency, reference, bookingId, paymentId FROM `LedgerEntry`");
    for (const row of mysqlLedgerIds) {
      const pg = await prisma.ledgerEntry.findUnique({ where: { id: row.id } });
      if (!pg) throw new Error(`Ledger ${row.id} missing after migration.`);
      if (!decimalEq(pg.amount, row.amount)) throw new Error(`Ledger ${row.id} amount mismatch.`);
      if (pg.currency !== row.currency) throw new Error(`Ledger ${row.id} currency mismatch.`);
      if (pg.reference !== row.reference) throw new Error(`Ledger ${row.id} reference mismatch.`);
      if ((pg.bookingId ?? null) !== (row.bookingId ?? null)) throw new Error(`Ledger ${row.id} booking association mismatch.`);
      if (pg.type !== row.type) throw new Error(`Ledger ${row.id} type/sign mismatch.`);
    }

    const mysqlDebit = mysqlByType.DEBIT?.total ?? "0";
    const mysqlCredit = mysqlByType.CREDIT?.total ?? "0";
    const mysqlRefund = mysqlByType.REFUND?.total ?? "0";
    report.financial.ledgerDebit = { mysql: mysqlDebit, postgres: pgByType.DEBIT?.total ?? "0" };
    report.financial.ledgerCredit = { mysql: mysqlCredit, postgres: pgByType.CREDIT?.total ?? "0" };
    report.financial.ledgerRefund = { mysql: mysqlRefund, postgres: pgByType.REFUND?.total ?? "0" };
    report.financial.ledgerByType = ledgerCompare;

    if (!decimalEq(mysqlDebit, pgByType.DEBIT?.total ?? "0") && (pgByType.DEBIT?.n ?? 0) === (mysqlByType.DEBIT?.n ?? 0)) {
      throw new Error(`Ledger debit total mismatch MySQL=${mysqlDebit} PostgreSQL=${pgByType.DEBIT?.total}`);
    }
    if (!decimalEq(mysqlCredit, pgByType.CREDIT?.total ?? "0") && (pgByType.CREDIT?.n ?? 0) === (mysqlByType.CREDIT?.n ?? 0)) {
      throw new Error(`Ledger credit total mismatch MySQL=${mysqlCredit} PostgreSQL=${pgByType.CREDIT?.total}`);
    }

    const mysqlPayments = await mysqlQuery(
      conn,
      "SELECT CAST(SUM(amount) AS CHAR) AS total, COUNT(*) AS n FROM `Payment`",
    );
    const pgPayments = await prisma.payment.aggregate({ _sum: { amount: true }, _count: true });
    report.financial.payments = {
      mysql: String(mysqlPayments[0].total ?? "0"),
      postgres: pgPayments._sum.amount == null ? "0" : String(pgPayments._sum.amount),
      mysqlN: Number(mysqlPayments[0].n),
      postgresN: pgPayments._count,
    };
    if (Number(mysqlPayments[0].n) === pgPayments._count && !decimalEq(report.financial.payments.mysql, report.financial.payments.postgres)) {
      throw new Error("Payment totals mismatch.");
    }

    const mysqlInvoices = await mysqlQuery(
      conn,
      "SELECT CAST(SUM(total) AS CHAR) AS total, COUNT(*) AS n FROM `Invoice`",
    );
    const pgInvoices = await prisma.invoice.aggregate({ _sum: { total: true }, _count: true });
    report.financial.invoices = {
      mysql: String(mysqlInvoices[0].total ?? "0"),
      postgres: pgInvoices._sum.total == null ? "0" : String(pgInvoices._sum.total),
      mysqlN: Number(mysqlInvoices[0].n),
      postgresN: pgInvoices._count,
    };
    if (Number(mysqlInvoices[0].n) === pgInvoices._count && !decimalEq(report.financial.invoices.mysql, report.financial.invoices.postgres)) {
      throw new Error("Invoice totals mismatch.");
    }

    const mysqlWallets = await mysqlQuery(conn, "SELECT id, ownerId, ownerType, currency FROM `Wallet`");
    const walletBalances = [];
    for (const wallet of mysqlWallets) {
      const entries = await mysqlQuery(
        conn,
        "SELECT type, CAST(amount AS CHAR) AS amount FROM `LedgerEntry` WHERE walletId = ?",
        [wallet.id],
      );
      const pgEntries = await prisma.ledgerEntry.findMany({
        where: { walletId: wallet.id },
        select: { type: true, amount: true },
      });
      for (const row of entries) {
        const found = pgEntries.some((pg) => pg.type === row.type && decimalEq(pg.amount, row.amount));
        if (!found) throw new Error(`Wallet ${wallet.id} missing migrated ledger ${row.type} ${row.amount}`);
      }
      walletBalances.push({ walletId: wallet.id, mysqlLines: entries.length, postgresLines: pgEntries.length });
    }
    report.financial.walletsChecked = walletBalances.length;

    const mysqlBookings = await mysqlQuery(
      conn,
      "SELECT id, bookingRef, providerRef, CAST(totalAmount AS CHAR) AS totalAmount, currency, status, userId, organizationId FROM `Booking`",
    );
    for (const row of mysqlBookings) {
      const booking = await prisma.booking.findUnique({ where: { id: row.id } });
      if (!booking) throw new Error(`Booking ${row.id} missing.`);
      if (booking.bookingRef !== row.bookingRef) throw new Error(`Booking ${row.id} bookingRef mismatch.`);
      if ((booking.providerRef ?? null) !== (row.providerRef ?? null)) throw new Error(`Booking ${row.id} PNR/providerRef mismatch.`);
      if (!decimalEq(booking.totalAmount, row.totalAmount)) throw new Error(`Booking ${row.id} amount mismatch.`);
      if (booking.currency !== row.currency) throw new Error(`Booking ${row.id} currency mismatch.`);
    }

    const mysqlPaymentsRows = await mysqlQuery(
      conn,
      "SELECT id, providerRef, CAST(amount AS CHAR) AS amount, currency, status, idempotencyKey FROM `Payment`",
    );
    for (const row of mysqlPaymentsRows) {
      const payment = await prisma.payment.findUnique({ where: { id: row.id } });
      if (!payment) throw new Error(`Payment ${row.id} missing.`);
      if ((payment.providerRef ?? null) !== (row.providerRef ?? null)) throw new Error(`Payment ${row.id} providerRef mismatch.`);
      if (!decimalEq(payment.amount, row.amount)) throw new Error(`Payment ${row.id} amount mismatch.`);
      if (payment.currency !== row.currency) throw new Error(`Payment ${row.id} currency mismatch.`);
    }

    const mysqlInvoicesRows = await mysqlQuery(conn, "SELECT id, invoiceNo, CAST(total AS CHAR) AS total, currency FROM `Invoice`");
    for (const row of mysqlInvoicesRows) {
      const invoice = await prisma.invoice.findUnique({ where: { id: row.id } });
      if (!invoice) throw new Error(`Invoice ${row.id} missing.`);
      if (invoice.invoiceNo !== row.invoiceNo) throw new Error(`Invoice ${row.id} invoiceNo mismatch.`);
      if (!decimalEq(invoice.total, row.total)) throw new Error(`Invoice ${row.id} total mismatch.`);
    }

    const mysqlTickets = await mysqlQuery(conn, "SELECT id, ticketNumber, bookingId FROM `Ticket`");
    for (const row of mysqlTickets) {
      const ticket = await prisma.ticket.findUnique({ where: { id: row.id } });
      if (!ticket) throw new Error(`Ticket ${row.id} missing.`);
      if (ticket.ticketNumber !== row.ticketNumber) throw new Error(`Ticket ${row.id} ticketNumber mismatch.`);
    }

    const orphanSql = [
      ["Booking.userId", `SELECT COUNT(*) AS n FROM "Booking" b LEFT JOIN "User" u ON u.id = b."userId" WHERE b."userId" IS NOT NULL AND u.id IS NULL`],
      ["Booking.organizationId", `SELECT COUNT(*) AS n FROM "Booking" b LEFT JOIN "Organization" o ON o.id = b."organizationId" WHERE b."organizationId" IS NOT NULL AND o.id IS NULL`],
      ["BookingPassenger.bookingId", `SELECT COUNT(*) AS n FROM "BookingPassenger" p LEFT JOIN "Booking" b ON b.id = p."bookingId" WHERE b.id IS NULL`],
      ["Payment.bookingId", `SELECT COUNT(*) AS n FROM "Payment" p LEFT JOIN "Booking" b ON b.id = p."bookingId" WHERE b.id IS NULL`],
      ["Ticket.bookingId", `SELECT COUNT(*) AS n FROM "Ticket" t LEFT JOIN "Booking" b ON b.id = t."bookingId" WHERE b.id IS NULL`],
      ["Invoice.bookingId", `SELECT COUNT(*) AS n FROM "Invoice" i LEFT JOIN "Booking" b ON b.id = i."bookingId" WHERE i."bookingId" IS NOT NULL AND b.id IS NULL`],
      ["LedgerEntry.walletId", `SELECT COUNT(*) AS n FROM "LedgerEntry" l LEFT JOIN "Wallet" w ON w.id = l."walletId" WHERE w.id IS NULL`],
      ["LedgerEntry.organization via wallet", `SELECT COUNT(*) AS n FROM "LedgerEntry" l JOIN "Wallet" w ON w.id = l."walletId" LEFT JOIN "Organization" o ON o.id = w."ownerId" WHERE w."ownerType" = 'ORGANIZATION' AND o.id IS NULL`],
    ];
    for (const [label, sql] of orphanSql) {
      const rows = await prisma.$queryRawUnsafe(sql);
      const n = Number(rows[0]?.n ?? 0);
      report.orphans[label] = n;
      if (n > 0) throw new Error(`Unexpected orphan records: ${label} count=${n}`);
    }

    const seqRows = await prisma.$queryRaw`
      SELECT COALESCE(MAX(id), 0)::int AS max,
             (SELECT last_value FROM "Agent_id_seq")::int AS last
      FROM "Agent"
    `;
    const maxId = Number(seqRows[0]?.max ?? 0);
    const last = Number(seqRows[0]?.last ?? 0);
    report.sequences.Agent = { max: maxId, lastValue: last };
    if (maxId > 0 && last < maxId) {
      throw new Error(`Agent sequence last_value=${last} < MAX(id)=${maxId}`);
    }

    const probeEmail = `cutover.seq.${Date.now()}@onetrips.test`;
    const agent = await prisma.agent.create({
      data: {
        fullName: "Cutover Sequence Probe",
        companyName: "ONETRIPS",
        email: probeEmail,
        phone: "00000000000",
        country: "BD",
        city: "Dhaka",
        password: "unused",
      },
    });
    if (maxId > 0 && agent.id <= maxId) {
      await prisma.agent.delete({ where: { id: agent.id } });
      throw new Error(`New Agent id ${agent.id} collides with migrated MAX(id)=${maxId}`);
    }
    const user = await prisma.user.create({
      data: {
        email: probeEmail,
        passwordHash: "x",
        displayName: "Cutover ID Probe",
        type: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const clash = await mysqlQuery(conn, "SELECT id FROM `User` WHERE id = ?", [user.id]);
    if (clash.length) {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.agent.delete({ where: { id: agent.id } });
      throw new Error(`New User id collided with MySQL id ${user.id}`);
    }
    report.identities = { newAgentId: agent.id, newUserId: user.id, mysqlUserCollision: false };
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.agent.delete({ where: { id: agent.id } });
    log(`Sequence probe Agent.id=${agent.id} User.id=${user.id} (deleted after check)`);

    report.finishedAt = new Date().toISOString();
    report.ok = true;
    const reportDir = join(repoRoot, "backups");
    mkdirSync(reportDir, { recursive: true });
    const reportPath = join(reportDir, `mysql-postgres-verify-${Date.now()}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    log(`Report ${reportPath}`);
    log("SUCCESS MySQL vs PostgreSQL validation.");
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
