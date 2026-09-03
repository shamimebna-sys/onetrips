import type { Money } from "@onetrips/shared";

export type PaymentMethod = "CARD" | "BKASH" | "NAGAD" | "BANK";

export type PaymentInitRequest = {
  bookingId: string;
  bookingRef: string;
  amount: Money;
  idempotencyKey: string;
  returnUrl: string;
  method: PaymentMethod;
  customerEmail?: string;
};

export type PaymentInitResponse = {
  providerRef: string;
  redirectUrl: string;
  status: "PENDING" | "PROCESSING";
};

export type PaymentVerifyResult = {
  status: "SUCCESS" | "FAILED" | "PENDING";
  providerRef: string;
};

export type PaymentWebhookPayload = {
  eventId: string;
  providerRef: string;
  status: "SUCCESS" | "FAILED";
  amount: string;
  currency: string;
};

export type PaymentProviderPort = {
  readonly id: string;
  initiate(request: PaymentInitRequest): Promise<PaymentInitResponse>;
  verify(providerRef: string): Promise<PaymentVerifyResult>;
  refund(providerRef: string, amount: Money, idempotencyKey: string): Promise<{ refundRef: string }>;
  parseWebhook(rawBody: string, signature: string | null): PaymentWebhookPayload;
};
