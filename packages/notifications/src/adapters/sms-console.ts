import { randomUUID } from "node:crypto";
import type { SmsPort } from "../types";

export class ConsoleSmsAdapter implements SmsPort {
  readonly id = "sms-console";

  async send(to: string, text: string) {
    const providerRef = `sms-dev-${randomUUID()}`;
    console.info(`[sms:${this.id}] to=${to} ref=${providerRef}`);
    console.info(text);
    return { providerRef };
  }
}
