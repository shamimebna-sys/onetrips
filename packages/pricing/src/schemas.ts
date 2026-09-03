import { z } from "zod";

function optionalText() {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.string().nullable().optional());
}

function optionalCode(length: number) {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim().toUpperCase();
    return trimmed.length === 0 ? null : trimmed;
  }, z.string().length(length).nullable().optional());
}

export const markupRuleSchema = z.object({
  supplierId: optionalText(),
  airlineCode: optionalCode(2),
  routeOrigin: optionalCode(3),
  routeDest: optionalCode(3),
  cabin: optionalText(),
  markupType: z.enum(["FLAT", "PERCENT"]),
  markupValue: z.number().min(0).max(1_000_000),
  currency: optionalCode(3),
  appliesTo: z.enum(["B2C", "B2B", "ORGANIZATION"]).default("B2C"),
  organizationId: optionalText(),
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(0).max(10_000).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const markupRulePatchSchema = markupRuleSchema.partial();

export const serviceFeeRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  amount: z.number().min(0).max(1_000_000),
  type: z.enum(["FLAT", "PERCENT"]),
  appliesTo: z.enum(["B2C", "B2B", "ORGANIZATION"]).default("B2C"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const serviceFeeRulePatchSchema = serviceFeeRuleSchema.partial();
