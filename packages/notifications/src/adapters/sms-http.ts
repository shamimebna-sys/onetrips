import { DomainError } from "@onetrips/shared";
import type { SmsPort } from "../types";

export class HttpSmsAdapter implements SmsPort {
  readonly id = "sms-http";

  async send(to: string, text: string) {
    const url = process.env.SMS_API_URL;
    if (!url) throw new DomainError("SMS_NOT_CONFIGURED", "SMS_API_URL is not set.", 500);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.SMS_API_KEY) headers.Authorization = `Bearer ${process.env.SMS_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ to, text, from: process.env.SMS_FROM || "ONETRIPS" }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new DomainError("SMS_FAILED", body.slice(0, 180) || "SMS gateway declined the message.", 502);
    }
    return { providerRef: body.slice(0, 64) || `sms-http-${Date.now()}` };
  }
}
