export type NotificationChannel = "EMAIL" | "SMS" | "PUSH";

export type NotificationAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type NotificationMessage = {
  channel: NotificationChannel;
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
  attachments?: NotificationAttachment[];
};

export type RenderedEmail = {
  to: string;
  subject: string;
  text: string;
  attachments?: NotificationAttachment[];
};

export type NotificationPort = {
  readonly id: string;
  send(message: RenderedEmail): Promise<{ providerRef: string }>;
};

export type SmsPort = {
  readonly id: string;
  send(to: string, text: string): Promise<{ providerRef: string }>;
};

export type QueueJob = {
  logId: string;
  channel: Exclude<NotificationChannel, "PUSH">;
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
  attachments?: Array<{ filename: string; contentBase64: string; contentType: string }>;
  attempt: number;
};

export type EnqueueResult = {
  logId: string;
  queued: boolean;
  sent: boolean;
  provider: string;
};
