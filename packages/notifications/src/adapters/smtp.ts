import nodemailer from "nodemailer";
import { DomainError } from "@onetrips/shared";
import type { NotificationPort, RenderedEmail } from "../types";

export class SmtpEmailAdapter implements NotificationPort {
  readonly id = "smtp";

  async send(message: RenderedEmail) {
    const host = process.env.SMTP_HOST;
    if (!host) throw new DomainError("SMTP_NOT_CONFIGURED", "SMTP_HOST is not set.", 500);
    const port = Number(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "ONETRIPS <noreply@onetrips.com>",
      to: message.to,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments?.map((row) => ({
        filename: row.filename,
        content: row.content,
        contentType: row.contentType,
      })),
    });
    return { providerRef: String(result.messageId || result.response || "smtp") };
  }
}
