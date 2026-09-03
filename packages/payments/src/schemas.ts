import { z } from "zod";

export const initiatePaymentSchema = z.object({
  method: z.enum(["CARD", "BKASH", "NAGAD", "BANK"]).default("CARD"),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().min(8).optional(),
  providerRef: z.string().min(4).optional(),
});
