import { DomainError } from "@onetrips/shared";
import { signPayload, verifySignature } from "../crypto";
import type { PaymentInitRequest, PaymentInitResponse, PaymentProviderPort, PaymentVerifyResult, PaymentWebhookPayload } from "../types";

type Session = {
  providerRef: string;
  bookingId: string;
  amount: string;
  currency: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  returnUrl: string;
};

const sessions = new Map<string, Session>();

export function getMockSession(providerRef: string) {
  return sessions.get(providerRef) ?? null;
}

export function setMockOutcome(providerRef: string, status: "SUCCESS" | "FAILED") {
  const session = sessions.get(providerRef);
  if (!session) throw new DomainError("PAYMENT_NOT_FOUND", "Unknown payment session.", 404);
  session.status = status;
  sessions.set(providerRef, session);
  return session;
}

export class MockPaymentProvider implements PaymentProviderPort {
  readonly id = "mock-gateway";

  async initiate(request: PaymentInitRequest): Promise<PaymentInitResponse> {
    const providerRef = `MOCK${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`;
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirect = new URL("/pay/sandbox", origin);
    redirect.searchParams.set("ref", providerRef);
    redirect.searchParams.set("amount", request.amount.amount);
    redirect.searchParams.set("currency", request.amount.currency);
    redirect.searchParams.set("booking", request.bookingRef);
    redirect.searchParams.set("return", request.returnUrl);
    sessions.set(providerRef, {
      providerRef,
      bookingId: request.bookingId,
      amount: request.amount.amount,
      currency: request.amount.currency,
      status: "PROCESSING",
      returnUrl: request.returnUrl,
    });
    return { providerRef, redirectUrl: redirect.toString(), status: "PROCESSING" };
  }

  async verify(providerRef: string): Promise<PaymentVerifyResult> {
    const session = sessions.get(providerRef);
    if (!session) return { providerRef, status: "PENDING" };
    if (session.status === "SUCCESS" || session.status === "FAILED") {
      return { providerRef, status: session.status };
    }
    return { providerRef, status: "PENDING" };
  }

  async refund(providerRef: string, _amount: PaymentInitRequest["amount"], _idempotencyKey: string) {
    return { refundRef: `RF${providerRef.slice(-8)}` };
  }

  parseWebhook(rawBody: string, signature: string | null): PaymentWebhookPayload {
    verifySignature(rawBody, signature);
    const data = JSON.parse(rawBody) as PaymentWebhookPayload;
    if (!data.eventId || !data.providerRef || !data.status) {
      throw new DomainError("INVALID_WEBHOOK", "Malformed payment webhook.", 400);
    }
    return data;
  }
}

export function signedWebhookBody(payload: PaymentWebhookPayload) {
  const raw = JSON.stringify(payload);
  return { raw, signature: signPayload(raw) };
}
