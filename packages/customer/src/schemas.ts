import { z } from "zod";

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]).optional(),
  nationality: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value.toUpperCase() : "")),
  addressLine1: z.string().trim().max(160).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  countryId: z.string().trim().max(8).optional().or(z.literal("")),
});

export const passengerWriteSchema = z.object({
  type: z.enum(["ADULT", "CHILD", "INFANT"]),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  nationality: z.string().trim().max(64).optional().or(z.literal("")),
  passportNumber: z.string().trim().max(32).optional().or(z.literal("")),
  passportExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  frequentFlyerNumber: z.string().trim().max(64).optional().or(z.literal("")),
  isPreferred: z.boolean().optional(),
});

export const preferenceUpdateSchema = z.object({
  locale: z.enum(["en", "bn"]).default("en"),
  currency: z.enum(["BDT", "USD", "EUR", "AED", "SAR", "GBP"]).default("BDT"),
  emailOptIn: z.boolean().default(true),
  smsOptIn: z.boolean().default(true),
  marketingOptIn: z.boolean().default(false),
});

export const phoneOtpSchema = z.object({
  phone: z.string().trim().min(8).max(20),
});

export const phoneVerifySchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().regex(/^\d{6}$/),
});
