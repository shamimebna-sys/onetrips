import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { deliverJob, getEmailAdapter, getSmsAdapter } from "./deliver";
import { enqueueDelayed, enqueueJob, queueBackend, queueDepth } from "./queue";
import type { EnqueueResult, NotificationMessage, QueueJob } from "./types";

const MAX_ATTEMPTS = 5;

function backoffMs(attempt: number) {
  return Math.min(15 * 60 * 1000, 15_000 * 2 ** Math.max(0, attempt - 1));
}

function assertRecipient(message: NotificationMessage) {
  if (message.channel === "PUSH") {
    throw new DomainError("NOT_IMPLEMENTED", "Push notifications are not enabled yet.", 501);
  }
  if (message.channel === "EMAIL" && !message.recipient.includes("@")) {
    throw new DomainError("INVALID_RECIPIENT", "A valid email address is required.", 400);
  }
  if (message.channel === "SMS" && message.recipient.replace(/\D/g, "").length < 8) {
    throw new DomainError("INVALID_RECIPIENT", "A valid phone number is required.", 400);
  }
}

function toJob(message: NotificationMessage, logId: string, attempt = 0): QueueJob {
  return {
    logId,
    channel: message.channel === "SMS" ? "SMS" : "EMAIL",
    recipient: message.recipient,
    template: message.template,
    payload: message.payload,
    attempt,
    attachments: message.attachments?.map((row) => ({
      filename: row.filename,
      contentBase64: row.content.toString("base64"),
      contentType: row.contentType,
    })),
  };
}

export function describeEmailProvider() {
  return getEmailAdapter().id;
}

export function describeSmsProvider() {
  return getSmsAdapter().id;
}

export function describeNotificationProviders() {
  return {
    email: describeEmailProvider(),
    sms: describeSmsProvider(),
    queue: queueBackend(),
    smtpConfigured: Boolean(process.env.SMTP_HOST),
    smsConfigured: Boolean(process.env.SMS_API_URL),
  };
}

const REQUIRED_TEMPLATES = new Set([
  "OTP",
  "SMS_OTP",
  "PASSWORD_RESET",
  "PAYMENT_SUCCESS",
  "ETICKET",
  "SMS_TICKETED",
  "BOOKING_CANCELLED",
  "BOOKING_REFUNDED",
  "SMS_CANCELLED",
]);

export async function enqueueNotification(message: NotificationMessage, userId?: string | null): Promise<EnqueueResult> {
  assertRecipient(message);
  if (userId && !REQUIRED_TEMPLATES.has(message.template)) {
    const pref = await prisma.customerPreference.findUnique({ where: { customerId: userId } });
    if (pref) {
      const blocked =
        (message.channel === "EMAIL" && !pref.emailOptIn) ||
        (message.channel === "SMS" && !pref.smsOptIn) ||
        (message.template.includes("MARKETING") && !pref.marketingOptIn);
      if (blocked) {
        return { logId: "skipped", queued: false, sent: false, provider: "preference" };
      }
    }
  }
  const adapterId = message.channel === "SMS" ? getSmsAdapter().id : getEmailAdapter().id;
  const stored = await prisma.notificationTemplate.findUnique({ where: { name: message.template } });
  const log = await prisma.notificationLog.create({
    data: {
      userId: userId ?? undefined,
      type: message.channel,
      channel: adapterId,
      recipient: message.recipient,
      templateId: stored?.id ?? message.template.slice(0, 64),
      payload: { ...message.payload, _template: message.template } as object,
      status: "QUEUED",
    },
  });

  if (userId && message.template !== "OTP" && message.template !== "SMS_OTP") {
    const payload = (message.payload ?? {}) as Record<string, unknown>;
    const bookingId = typeof payload.bookingId === "string" ? payload.bookingId : null;
    await prisma.inAppNotification.create({
      data: {
        userId,
        type: message.template.slice(0, 32),
        title: message.template.replaceAll("_", " "),
        body: "There is a new update on your ONETRIPS trip.",
        deepLink: bookingId ? `/booking/${bookingId}` : "/account/trips",
      },
    });
  }

  const job = toJob(message, log.id);
  const queued = process.env.NOTIFY_INLINE === "1" ? false : await enqueueJob(job);
  if (queued) {
    return { logId: log.id, queued: true, sent: false, provider: adapterId };
  }

  try {
    await deliverJob(job);
    return { logId: log.id, queued: false, sent: true, provider: adapterId };
  } catch (error) {
    console.error("Inline notification failed", error);
    return { logId: log.id, queued: false, sent: false, provider: adapterId };
  }
}

/** @deprecated Prefer enqueueNotification. Kept for callers that still await send. */
export async function sendNotification(message: NotificationMessage, userId?: string | null) {
  const result = await enqueueNotification(message, userId);
  return {
    providerRef: result.logId,
    logId: result.logId,
    queued: result.queued,
    sent: result.sent,
    provider: result.provider,
  };
}

export async function processQueuedJob(job: QueueJob) {
  try {
    await deliverJob(job);
    return { ok: true as const };
  } catch (error) {
    const nextAttempt = job.attempt + 1;
    if (nextAttempt < MAX_ATTEMPTS) {
      const delayed = await enqueueDelayed({ ...job, attempt: nextAttempt }, backoffMs(nextAttempt));
      if (!delayed) {
        console.error("Notification retry lost (no Redis)", error);
      }
      return { ok: false as const, retry: true, attempt: nextAttempt };
    }
    return { ok: false as const, retry: false, attempt: nextAttempt };
  }
}

export async function retryNotification(id: string) {
  const log = await prisma.notificationLog.findUnique({ where: { id } });
  if (!log || log.status === "SENT") {
    throw new DomainError("NOTIFY_NOT_FOUND", "Failed notification not found.", 404);
  }
  if (log.type === "PUSH") {
    throw new DomainError("NOT_IMPLEMENTED", "Push notifications are not enabled yet.", 501);
  }
  await prisma.notificationLog.update({ where: { id }, data: { status: "QUEUED", providerRef: null } });
  const payload = (log.payload && typeof log.payload === "object" ? log.payload : {}) as Record<string, unknown>;
  const templateName = typeof payload._template === "string" ? payload._template : "OTP";
  const job: QueueJob = {
    logId: log.id,
    channel: log.type === "SMS" ? "SMS" : "EMAIL",
    recipient: log.recipient,
    template: templateName,
    payload,
    attempt: 0,
  };
  const queued = await enqueueJob(job);
  if (!queued) await deliverJob(job);
  return { id: log.id, queued };
}

export async function listNotificationLogs(input: { take?: number; status?: "QUEUED" | "SENT" | "FAILED" } = {}) {
  const rows = await prisma.notificationLog.findMany({
    where: input.status ? { status: input.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, input.take ?? 80)),
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    channel: row.channel,
    recipient: row.recipient,
    status: row.status,
    providerId: row.providerId,
    providerRef: row.providerRef,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getNotificationOverview() {
  const [logs, queue, counts] = await Promise.all([
    listNotificationLogs({ take: 80 }),
    queueDepth(),
    prisma.notificationLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    providers: describeNotificationProviders(),
    queue,
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    logs,
  };
}

export async function listInbox(userId: string, unreadOnly = false) {
  const [rows, unreadCount] = await Promise.all([
    prisma.inAppNotification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.inAppNotification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    unreadCount,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      deepLink: row.deepLink,
      read: Boolean(row.readAt),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function markInboxRead(userId: string, id?: string) {
  if (id) {
    await prisma.inAppNotification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.inAppNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
  return { ok: true as const };
}
