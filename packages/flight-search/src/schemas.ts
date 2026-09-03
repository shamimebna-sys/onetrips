import { z } from "zod";

const iata = z
  .string()
  .trim()
  .transform((value) => value.slice(0, 3).toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "Enter a 3-letter IATA code.");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const searchSegmentSchema = z.object({
  origin: iata,
  destination: iata,
  date: isoDate,
});

export const searchRequestSchema = z
  .object({
    tripType: z.enum(["one-way", "round-trip", "multi-city"]),
    segments: z.array(searchSegmentSchema).min(1).max(6),
    adults: z.number().int().min(1).max(9).default(1),
    children: z.number().int().min(0).max(8).default(0),
    infants: z.number().int().min(0).max(4).default(0),
    cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
  })
  .superRefine((data, ctx) => {
    if (data.adults + data.children > 9) {
      ctx.addIssue({ code: "custom", message: "Maximum 9 adults and children combined.", path: ["adults"] });
    }
    if (data.infants > data.adults) {
      ctx.addIssue({ code: "custom", message: "Each infant must travel with an adult.", path: ["infants"] });
    }
    if (data.tripType === "one-way" && data.segments.length !== 1) {
      ctx.addIssue({ code: "custom", message: "One-way search needs a single segment.", path: ["segments"] });
    }
    if (data.tripType === "round-trip" && data.segments.length !== 2) {
      ctx.addIssue({ code: "custom", message: "Round-trip search needs outbound and return segments.", path: ["segments"] });
    }
    if (data.tripType === "multi-city" && data.segments.length < 2) {
      ctx.addIssue({ code: "custom", message: "Multi-city search needs at least two flights.", path: ["segments"] });
    }
  });

export const searchFiltersSchema = z.object({
  sort: z.enum(["recommended", "price", "duration", "departure"]).optional(),
  stops: z.array(z.number().int().min(0).max(2)).optional(),
  airlines: z.array(z.string().trim().min(2).max(3)).optional(),
  maxPrice: z.number().int().positive().optional(),
  refundable: z.boolean().optional(),
  departPeriod: z.enum(["morning", "afternoon", "evening"]).optional(),
  arrivePeriod: z.enum(["morning", "afternoon", "evening"]).optional(),
  maxDurationMinutes: z.number().int().positive().optional(),
  baggage: z.boolean().optional(),
  fareFamily: z.string().trim().min(2).max(40).optional(),
});

export function searchRequestFromQuery(query: URLSearchParams) {
  const tripType = (query.get("type") ?? "one-way") as string;
  const adults = Number(query.get("adults") ?? 1);
  const children = Number(query.get("children") ?? 0);
  const infants = Number(query.get("infants") ?? 0);
  const cabin = (query.get("cabin") ?? "ECONOMY").toUpperCase();

  if (tripType === "multi-city") {
    const raw = query.get("segments") ?? "";
    const segments = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [origin, destination, date] = part.split("~");
        return { origin, destination, date };
      });
    return { tripType, segments, adults, children, infants, cabin };
  }

  const origin = query.get("from") ?? "";
  const destination = query.get("to") ?? "";
  const date = query.get("date") ?? "";
  const segments = [{ origin, destination, date }];
  if (tripType === "round-trip") {
    segments.push({
      origin: destination,
      destination: origin,
      date: query.get("return") ?? "",
    });
  }
  return { tripType, segments, adults, children, infants, cabin };
}

export function filtersFromQuery(query: URLSearchParams) {
  const stops = query.getAll("stops").map(Number).filter((value) => Number.isFinite(value));
  const airlines = query.getAll("airline");
  const maxPrice = query.get("maxPrice");
  const refundable = query.get("refundable");
  const baggage = query.get("baggage");
  const maxDurationMinutes = query.get("maxDurationMinutes");
  return searchFiltersSchema.parse({
    sort: query.get("sort") ?? undefined,
    stops: stops.length ? stops : undefined,
    airlines: airlines.length ? airlines : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    refundable: refundable === "true" ? true : refundable === "false" ? false : undefined,
    departPeriod: query.get("departPeriod") ?? undefined,
    arrivePeriod: query.get("arrivePeriod") ?? undefined,
    maxDurationMinutes: maxDurationMinutes ? Number(maxDurationMinutes) : undefined,
    baggage: baggage === "true" ? true : undefined,
    fareFamily: query.get("fareFamily") ?? undefined,
  });
}
