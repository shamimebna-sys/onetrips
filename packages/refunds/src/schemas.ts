import { z } from "zod";

export const cancelSchema = z.object({
  reason: z.string().trim().max(255).optional(),
  refund: z.boolean().optional(),
});

export const refundSchema = z.object({
  reason: z.string().trim().max(255).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
});
