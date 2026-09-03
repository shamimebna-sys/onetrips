import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const customerRegisterSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(20),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms and Conditions." }) }),
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: "You must acknowledge the Privacy Policy." }) }),
  marketingConsent: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

export const b2bRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(20),
  country: z.string().trim().min(2).max(64),
  city: z.string().trim().min(2).max(64),
  password: z.string().min(8, "Password must be at least 8 characters"),
  nidUrl: z.string().min(1),
  tradeLicenseUrl: z.string().nullable().optional(),
});

export const otpRequestSchema = z.object({
  destination: z.string().trim().min(5).max(128),
  channel: z.enum(["EMAIL", "SMS"]).default("EMAIL"),
  purpose: z.enum(["REGISTER", "LOGIN", "RESET", "PHONE_VERIFY"]),
});

export const otpVerifySchema = z.object({
  destination: z.string().trim().min(5).max(128),
  purpose: z.enum(["REGISTER", "LOGIN", "RESET", "PHONE_VERIFY"]),
  code: z.string().regex(/^\d{6}$/),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});
