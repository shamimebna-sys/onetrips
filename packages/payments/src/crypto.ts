import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "@onetrips/shared";

export function webhookSecret() {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || /replace-with|onetrips-dev/i.test(secret)) {
      throw new Error("PAYMENT_WEBHOOK_SECRET must be a strong production secret.");
    }
    return secret;
  }
  if (secret && secret.length >= 16 && !/replace-with|onetrips-dev/i.test(secret)) return secret;
  return "onetrips-dev-payment-webhook";
}

export function signPayload(raw: string) {
  return createHmac("sha256", webhookSecret()).update(raw).digest("hex");
}

export function verifySignature(raw: string, signature: string | null) {
  if (!signature) {
    throw new DomainError("INVALID_SIGNATURE", "Missing payment webhook signature.", 401);
  }
  const expected = Buffer.from(signPayload(raw));
  const got = Buffer.from(signature);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    throw new DomainError("INVALID_SIGNATURE", "Invalid payment webhook signature.", 401);
  }
}
