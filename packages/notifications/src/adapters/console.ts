import { randomUUID } from "node:crypto";
import type { NotificationPort, RenderedEmail } from "../types";

export class ConsoleEmailAdapter implements NotificationPort {
  readonly id = "console";

  async send(message: RenderedEmail) {
    const providerRef = `dev-${randomUUID()}`;
    console.info(`[email:${this.id}] to=${message.to} subject=${message.subject} ref=${providerRef}`);
    console.info(message.text);
    if (message.attachments?.length) {
      console.info(`[email:${this.id}] attachments=${message.attachments.map((row) => row.filename).join(", ")}`);
    }
    return { providerRef };
  }
}
