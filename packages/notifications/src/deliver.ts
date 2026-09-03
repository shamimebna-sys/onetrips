import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { ConsoleEmailAdapter } from "./adapters/console";
import { SmtpEmailAdapter } from "./adapters/smtp";
import { ConsoleSmsAdapter } from "./adapters/sms-console";
import { HttpSmsAdapter } from "./adapters/sms-http";
import { interpolate, DEFAULT_TEMPLATES } from "./templates";
import type { QueueJob } from "./types";

export function getEmailAdapter() {
  return process.env.SMTP_HOST ? new SmtpEmailAdapter() : new ConsoleEmailAdapter();
}

export function getSmsAdapter() {
  return process.env.SMS_API_URL ? new HttpSmsAdapter() : new ConsoleSmsAdapter();
}

async function resolveTemplate(name: string, channel: "EMAIL" | "SMS") {
  const stored = await prisma.notificationTemplate.findUnique({ where: { name } });
  if (stored) {
    return { id: stored.id, subject: stored.subject || name, body: stored.body };
  }
  const fallback = DEFAULT_TEMPLATES[name];
  if (fallback && fallback.channel === channel) {
    return { id: name, subject: fallback.subject || name, body: fallback.body };
  }
  return {
    id: name,
    subject: name,
    body: channel === "SMS" ? "{{text}}" : JSON.stringify({ template: name }),
  };
}

export async function deliverJob(job: QueueJob) {
  const log = await prisma.notificationLog.findUnique({ where: { id: job.logId } });
  if (!log) throw new DomainError("NOTIFY_NOT_FOUND", "Notification log not found.", 404);
  if (log.status === "SENT") return { skipped: true as const, providerRef: log.providerRef ?? "already-sent" };

  const template = await resolveTemplate(job.template, job.channel);
  const text = interpolate(template.body, job.payload);

  try {
    if (job.channel === "SMS") {
      const adapter = getSmsAdapter();
      const result = await adapter.send(job.recipient, text);
      await prisma.notificationLog.update({
        where: { id: job.logId },
        data: { status: "SENT", providerId: adapter.id, channel: adapter.id, providerRef: result.providerRef.slice(0, 64) },
      });
      return { skipped: false as const, providerRef: result.providerRef };
    }

    const adapter = getEmailAdapter();
    const attachments = job.attachments?.map((row) => ({
      filename: row.filename,
      content: Buffer.from(row.contentBase64, "base64"),
      contentType: row.contentType,
    }));
    const result = await adapter.send({
      to: job.recipient,
      subject: interpolate(template.subject, job.payload),
      text,
      attachments,
    });
    await prisma.notificationLog.update({
      where: { id: job.logId },
      data: { status: "SENT", providerId: adapter.id, channel: adapter.id, providerRef: result.providerRef.slice(0, 64) },
    });
    return { skipped: false as const, providerRef: result.providerRef };
  } catch (error) {
    await prisma.notificationLog.update({
      where: { id: job.logId },
      data: {
        status: "FAILED",
        providerRef: error instanceof Error ? error.message.slice(0, 64) : "send-failed",
      },
    });
    throw error;
  }
}
