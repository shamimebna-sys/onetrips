export const PAYMENT_STATES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "EXPIRED",
  "REFUND_INITIATED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

const TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  PENDING: ["PROCESSING", "EXPIRED"],
  PROCESSING: ["SUCCESS", "FAILED", "EXPIRED"],
  FAILED: ["PROCESSING"],
  SUCCESS: ["REFUND_INITIATED"],
  EXPIRED: ["PROCESSING"],
  REFUND_INITIATED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "REFUND_INITIATED"],
  REFUNDED: [],
};

export function canPaymentTransition(from: PaymentState, to: PaymentState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPaymentTransition(from: PaymentState, to: PaymentState): void {
  if (!canPaymentTransition(from, to)) {
    throw new Error(`Illegal payment transition: ${from} → ${to}`);
  }
}
