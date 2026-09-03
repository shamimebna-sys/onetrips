import { z } from "zod";

const iataAirport = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "IATA must be 3 letters");

const iataAirline = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9]{2}$/.test(value), "IATA must be 2 characters");

export const airportSearchSchema = z.object({
  q: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const airportWriteSchema = z.object({
  iataCode: iataAirport,
  name: z.string().trim().min(3).max(160),
  cityId: z.string().min(1),
  timezone: z.string().trim().min(3).max(64),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
});

export const airlineWriteSchema = z.object({
  iataCode: iataAirline,
  icaoCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "" || /^[A-Z]{3}$/.test(value), "ICAO must be 3 letters")
    .optional(),
  name: z.string().trim().min(2).max(160),
  logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
  isActive: z.boolean().optional(),
});

export const countryWriteSchema = z.object({
  code: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(80),
});

export const cityWriteSchema = z.object({
  countryId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().max(8).optional(),
});

export const supplierWriteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["GDS", "AIRLINE", "HOTEL", "PAYMENT", "SMS", "EMAIL"]),
  status: z.enum(["ACTIVE", "INACTIVE", "DEGRADED"]).optional(),
});
