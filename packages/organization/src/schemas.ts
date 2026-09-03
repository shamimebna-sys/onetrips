import { z } from "zod";

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  country: z.string().trim().min(2).max(64).optional(),
  city: z.string().trim().min(2).max(64).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(["ADMIN", "AGENT", "ACCOUNTANT", "VIEWER"]),
  password: z.string().min(8),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(255).optional(),
});

export const updateOrgStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"]),
});
