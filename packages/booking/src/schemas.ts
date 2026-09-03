import { z } from "zod";

export const createBookingSchema = z.object({
  sessionId: z.string().uuid(),
  offerId: z.string().min(4).max(160),
  product: z.enum(["FLIGHT", "HOTEL"]).optional(),
});

export const passengerInputSchema = z.object({
  type: z.enum(["ADULT", "CHILD", "INFANT"]),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationality: z.string().trim().min(2).max(64),
  passportNumber: z.string().trim().max(32).optional().or(z.literal("")),
  passportExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  savedPassengerId: z.string().optional(),
});

export const savePassengersSchema = z.object({
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  passengers: z.array(passengerInputSchema).min(1).max(9),
});
