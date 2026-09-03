import { prisma } from "@onetrips/database";
import type { LedgerType, WalletOwnerType, WalletStatus } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { deriveBalance } from "./balance";
import { creditLimitSchema, debitSchema, depositSchema } from "./schemas";

function money(value: { toString(): string } | number) {
  return Math.round(Number(value) * 100) / 100;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function ensureWallet(ownerId: string, ownerType: WalletOwnerType, currency = "BDT") {
  return prisma.wallet.upsert({
    where: { ownerId_ownerType_currency: { ownerId, ownerType, currency } },
    update: {},
    create: { ownerId, ownerType, currency, status: "ACTIVE" },
  });
}

async function creditContext(ownerId: string, ownerType: WalletOwnerType) {
  if (ownerType !== "ORGANIZATION") {
    return { creditLimit: 0, orgStatus: "ACTIVE" as const, orgName: null as string | null };
  }
  const org = await prisma.organization.findUnique({ where: { id: ownerId } });
  if (!org || org.deletedAt) throw new DomainError("ORG_NOT_FOUND", "Organization not found.", 404);
  return {
    creditLimit: money(org.creditLimit),
    orgStatus: org.status,
    orgName: org.name,
  };
}

export async function getWalletSnapshot(ownerId: string, ownerType: WalletOwnerType, currency = "BDT") {
  const wallet = await ensureWallet(ownerId, ownerType, currency);
  const entries = await prisma.ledgerEntry.findMany({
    where: { walletId: wallet.id },
    select: { type: true, amount: true },
  });
  const balance = deriveBalance(entries.map((row) => ({ type: row.type, amount: String(row.amount) })));
  const credit = await creditContext(ownerId, ownerType);
  const available = wallet.status === "FROZEN" || credit.orgStatus === "SUSPENDED" || credit.orgStatus === "REJECTED"
    ? 0
    : Math.max(0, money(balance + credit.creditLimit));
  return {
    walletId: wallet.id,
    ownerId,
    ownerType,
    currency: wallet.currency,
    status: wallet.status as WalletStatus,
    balance: money(balance),
    creditLimit: credit.creditLimit,
    available,
    organizationName: credit.orgName,
    organizationStatus: credit.orgStatus,
  };
}

export async function listLedger(ownerId: string, ownerType: WalletOwnerType, currency = "BDT", take = 50) {
  const wallet = await ensureWallet(ownerId, ownerType, currency);
  const rows = await prisma.ledgerEntry.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, take)),
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: money(row.amount),
    currency: row.currency,
    reference: row.reference,
    note: row.note,
    bookingId: row.bookingId,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function postEntry(params: {
  ownerId: string;
  ownerType: WalletOwnerType;
  type: LedgerType;
  amount: number;
  currency: string;
  reference: string;
  actorId?: string;
  bookingId?: string;
  paymentId?: string;
  note?: string;
}) {
  const wallet = await ensureWallet(params.ownerId, params.ownerType, params.currency);
  if (wallet.status !== "ACTIVE" && params.type !== "ADJUSTMENT" && params.type !== "DEBIT" && params.type !== "REFUND") {
    throw new DomainError("WALLET_FROZEN", "This wallet is not active.");
  }
  try {
    const entry = await prisma.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        type: params.type,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
        actorId: params.actorId,
        bookingId: params.bookingId,
        paymentId: params.paymentId,
        note: params.note?.slice(0, 255),
      },
    });
    return entry;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return prisma.ledgerEntry.findUniqueOrThrow({ where: { reference: params.reference } });
    }
    throw error;
  }
}

export async function depositToWallet(
  ownerId: string,
  ownerType: WalletOwnerType,
  actorId: string,
  input: unknown,
) {
  const data = depositSchema.parse(input);
  const reference = data.reference ?? `DEP-${ownerId.slice(-8)}-${Date.now()}`;
  await postEntry({
    ownerId,
    ownerType,
    type: "DEPOSIT",
    amount: money(data.amount),
    currency: data.currency,
    reference,
    actorId,
    note: data.note ?? "Wallet deposit",
  });
  return getWalletSnapshot(ownerId, ownerType, data.currency);
}

export async function debitWallet(
  ownerId: string,
  ownerType: WalletOwnerType,
  actorId: string,
  input: unknown,
) {
  const data = debitSchema.parse(input);
  const amount = money(data.amount);
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        if (ownerType === "ORGANIZATION") {
          await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${ownerId} FOR UPDATE`;
        }
        const wallet = await tx.wallet.upsert({
          where: { ownerId_ownerType_currency: { ownerId, ownerType, currency: data.currency } },
          update: {},
          create: { ownerId, ownerType, currency: data.currency, status: "ACTIVE" },
        });
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`;
        const entries = await tx.ledgerEntry.findMany({
          where: { walletId: wallet.id },
          select: { type: true, amount: true, reference: true },
        });
        const duplicate = entries.find((row) => row.reference === data.reference);
        if (duplicate) return;
        const locked = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        if (locked.status !== "ACTIVE") {
          throw new DomainError("WALLET_FROZEN", "This wallet is frozen.");
        }
        const org =
          ownerType === "ORGANIZATION"
            ? await tx.organization.findUnique({ where: { id: ownerId } })
            : null;
        if (ownerType === "ORGANIZATION") {
          if (!org || org.deletedAt) throw new DomainError("ORG_NOT_FOUND", "Organization not found.", 404);
          if (org.status !== "ACTIVE") {
            throw new DomainError("ORG_INACTIVE", "Organization is not active for spending.");
          }
        }
        const creditLimit = org ? money(org.creditLimit) : 0;
        const balance = deriveBalance(entries.map((row) => ({ type: row.type, amount: String(row.amount) })));
        const available = money(balance + creditLimit);
        if (amount > available) {
          throw new DomainError(
            "INSUFFICIENT_CREDIT",
            `Available ${data.currency} ${available.toLocaleString()} is not enough for this charge.`,
            402,
          );
        }
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            type: "DEBIT",
            amount,
            currency: data.currency,
            reference: data.reference,
            actorId,
            bookingId: data.bookingId,
            paymentId: data.paymentId,
            note: (data.note ?? "Wallet debit").slice(0, 255),
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 20_000 },
    );

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await run();
      break;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "P2034" && attempt < 7) continue;
      throw error;
    }
  }
  return getWalletSnapshot(ownerId, ownerType, data.currency);
}

export async function assertCanDebit(ownerId: string, ownerType: WalletOwnerType, amount: number, currency = "BDT") {
  const snapshot = await getWalletSnapshot(ownerId, ownerType, currency);
  if (snapshot.status !== "ACTIVE") {
    throw new DomainError("WALLET_FROZEN", "This wallet is frozen.");
  }
  if (ownerType === "ORGANIZATION" && snapshot.organizationStatus !== "ACTIVE") {
    throw new DomainError("ORG_INACTIVE", "Organization is not active for spending.");
  }
  if (money(amount) > snapshot.available) {
    throw new DomainError(
      "INSUFFICIENT_CREDIT",
      `Available ${snapshot.currency} ${snapshot.available.toLocaleString()} is not enough for this charge.`,
      402,
    );
  }
}

export async function setCreditLimit(organizationId: string, input: unknown) {
  const data = creditLimitSchema.parse(input);
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.deletedAt) throw new DomainError("ORG_NOT_FOUND", "Organization not found.", 404);
  await prisma.organization.update({
    where: { id: organizationId },
    data: { creditLimit: money(data.creditLimit) },
  });
  return getWalletSnapshot(organizationId, "ORGANIZATION", data.currency);
}

export async function setWalletStatus(ownerId: string, ownerType: WalletOwnerType, status: WalletStatus, currency = "BDT") {
  const wallet = await ensureWallet(ownerId, ownerType, currency);
  await prisma.wallet.update({ where: { id: wallet.id }, data: { status } });
  return getWalletSnapshot(ownerId, ownerType, currency);
}

export async function refundedAgainstPayment(paymentId: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { paymentId, type: "DEBIT", reference: { startsWith: `RF-${paymentId}` } },
  });
  return rows.reduce((sum, row) => sum + money(row.amount), 0);
}

export async function reverseGatewayCredit(paymentId: string, amount: number, actorId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { select: { userId: true } } },
  });
  if (!payment) throw new DomainError("PAYMENT_NOT_FOUND", "Payment not found.", 404);
  const credit = await prisma.ledgerEntry.findUnique({ where: { reference: `PAY-${paymentId}` } });
  const ownerId = credit
    ? (await prisma.wallet.findUniqueOrThrow({ where: { id: credit.walletId } })).ownerId
    : payment.booking.userId;
  const ownerType = credit
    ? (await prisma.wallet.findUniqueOrThrow({ where: { id: credit.walletId } })).ownerType
    : "CUSTOMER";
  if (!ownerId) return null;
  const prior = await prisma.ledgerEntry.count({
    where: { paymentId, type: "DEBIT", reference: { startsWith: `RF-${paymentId}` } },
  });
  return postEntry({
    ownerId,
    ownerType,
    type: "DEBIT",
    amount: money(amount),
    currency: payment.currency,
    reference: `RF-${paymentId}-${prior + 1}`,
    actorId,
    bookingId: payment.bookingId,
    paymentId,
    note: "Gateway refund",
  });
}

export async function reverseBookingWalletDebits(bookingId: string, actorId: string) {
  const debits = await prisma.ledgerEntry.findMany({
    where: { bookingId, type: "DEBIT", reference: { not: { startsWith: "RF-" } } },
    include: { wallet: true },
  });
  const posted = [];
  for (const debit of debits) {
    posted.push(
      await postEntry({
        ownerId: debit.wallet.ownerId,
        ownerType: debit.wallet.ownerType,
        type: "REFUND",
        amount: money(debit.amount),
        currency: debit.currency,
        reference: `RF-DEB-${debit.id}`.slice(0, 64),
        actorId,
        bookingId,
        paymentId: debit.paymentId ?? undefined,
        note: "Wallet debit reversed after refund",
      }),
    );
  }
  return posted;
}

export { deriveBalance } from "./balance";
export { depositSchema, debitSchema, creditLimitSchema } from "./schemas";
