import { z } from "zod";

export const supportCategorySchema = z.enum(["refund", "cancellation", "ticket", "hotel", "other"]);

export const createSupportRequestSchema = z.object({
  category: supportCategorySchema,
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(8).max(4000),
  bookingId: z.string().trim().min(8).max(64).optional(),
});

export const supportReplySchema = z.object({
  body: z.string().trim().min(2).max(4000),
});

export const supportStatusSchema = z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
