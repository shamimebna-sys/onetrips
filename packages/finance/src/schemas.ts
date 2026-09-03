import { z } from "zod";

export const depositSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3).default("BDT"),
  note: z.string().trim().max(255).optional(),
  reference: z.string().trim().min(8).max(64).optional(),
});

export const debitSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3).default("BDT"),
  reference: z.string().trim().min(8).max(64),
  bookingId: z.string().min(8).optional(),
  paymentId: z.string().min(8).optional(),
  note: z.string().trim().max(255).optional(),
});

export const creditLimitSchema = z.object({
  creditLimit: z.number().min(0).max(100_000_000),
  currency: z.string().length(3).default("BDT"),
});
