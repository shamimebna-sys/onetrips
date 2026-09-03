import { z } from "zod";

export const applyPromoSchema = z.object({
  code: z.string().trim().min(3).max(32),
});

export const promotionWriteSchema = z.object({
  code: z.string().trim().min(3).max(32).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional(),
  percentOff: z.number().min(1).max(80).optional(),
  amountOff: z.number().positive().optional(),
  minBookingAmount: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().optional(),
  currency: z.string().length(3).default("BDT"),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  usageLimit: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().default(1),
  airlineCode: z.string().length(3).optional(),
  routeOrigin: z.string().length(3).optional(),
  routeDest: z.string().length(3).optional(),
  flightEligible: z.boolean().default(true),
  hotelEligible: z.boolean().default(true),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
