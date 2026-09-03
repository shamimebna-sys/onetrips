import { prisma } from "@onetrips/database";
import type { ProviderOperationStatus, ProviderOperationType } from "@onetrips/database";
import { redact } from "./log";

export type OperationRecord = {
  id: string;
  bookingId: string | null;
  provider: string;
  operation: ProviderOperationType;
  idempotencyKey: string;
  correlationId: string;
  providerReference: string | null;
  status: ProviderOperationStatus;
  requestMetadata: unknown;
  responseMetadata: unknown;
  errorCode: string | null;
  errorMessage: string | null;
};

const memory = new Map<string, OperationRecord>();

function allowMemoryFallback() {
  return process.env.NODE_ENV !== "production";
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function fromPrisma(row: {
  id: string;
  bookingId: string | null;
  provider: string;
  operation: ProviderOperationType;
  idempotencyKey: string;
  correlationId: string;
  providerReference: string | null;
  status: ProviderOperationStatus;
  requestMetadata: unknown;
  responseMetadata: unknown;
  errorCode: string | null;
  errorMessage: string | null;
}): OperationRecord {
  return row;
}

export async function findOperation(idempotencyKey: string): Promise<OperationRecord | null> {
  try {
    const row = await prisma.providerOperation.findUnique({ where: { idempotencyKey } });
    if (row) return fromPrisma(row);
  } catch (error) {
    if (!allowMemoryFallback()) throw error;
  }
  return memory.get(idempotencyKey) ?? null;
}

export async function startOperation(input: {
  bookingId?: string;
  provider: string;
  operation: ProviderOperationType;
  idempotencyKey: string;
  correlationId: string;
  requestMetadata?: unknown;
}): Promise<OperationRecord> {
  const existing = await findOperation(input.idempotencyKey);
  if (existing) return existing;
  const data = {
    bookingId: input.bookingId,
    provider: input.provider,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    status: "STARTED" as const,
    requestMetadata: redact(input.requestMetadata) as object | undefined,
  };
  try {
    const row = await prisma.providerOperation.create({ data });
    return fromPrisma(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const row = await prisma.providerOperation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (row) return fromPrisma(row);
    }
    if (!allowMemoryFallback()) throw error;
    const record: OperationRecord = {
      id: input.idempotencyKey,
      bookingId: input.bookingId ?? null,
      provider: input.provider,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      providerReference: null,
      status: "STARTED",
      requestMetadata: redact(input.requestMetadata),
      responseMetadata: null,
      errorCode: null,
      errorMessage: null,
    };
    memory.set(input.idempotencyKey, record);
    return record;
  }
}

export async function finishOperation(
  idempotencyKey: string,
  patch: {
    status: ProviderOperationStatus;
    providerReference?: string | null;
    responseMetadata?: unknown;
    errorCode?: string;
    errorMessage?: string;
  },
) {
  const completedAt = new Date();
  try {
    await prisma.providerOperation.update({
      where: { idempotencyKey },
      data: {
        status: patch.status,
        providerReference: patch.providerReference,
        responseMetadata: redact(patch.responseMetadata) as object | undefined,
        errorCode: patch.errorCode?.slice(0, 64),
        errorMessage: patch.errorMessage?.slice(0, 255),
        completedAt,
      },
    });
  } catch (error) {
    if (!allowMemoryFallback()) throw error;
    const row = memory.get(idempotencyKey);
    if (row) {
      row.status = patch.status;
      row.providerReference = patch.providerReference ?? row.providerReference;
      row.responseMetadata = redact(patch.responseMetadata);
      row.errorCode = patch.errorCode?.slice(0, 64) ?? null;
      row.errorMessage = patch.errorMessage?.slice(0, 255) ?? null;
    }
  }
}

export async function listRecentOperations(take = 20) {
  try {
    const rows = await prisma.providerOperation.findMany({
      orderBy: { startedAt: "desc" },
      take,
      select: {
        id: true,
        bookingId: true,
        provider: true,
        operation: true,
        status: true,
        providerReference: true,
        errorCode: true,
        errorMessage: true,
        correlationId: true,
        startedAt: true,
        completedAt: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  } catch (error) {
    if (!allowMemoryFallback()) throw error;
    return [...memory.values()].slice(-take).reverse().map((row) => ({
      id: row.id,
      bookingId: row.bookingId,
      provider: row.provider,
      operation: row.operation,
      status: row.status,
      providerReference: row.providerReference,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      correlationId: row.correlationId,
      startedAt: new Date().toISOString(),
      completedAt: null,
    }));
  }
}

export function resetOperationsForTests() {
  memory.clear();
}
