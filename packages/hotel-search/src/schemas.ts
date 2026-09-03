import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const hotelSearchInputSchema = z
  .object({
    destination: z.string().trim().min(2).max(80),
    checkIn: isoDate,
    checkOut: isoDate,
    rooms: z.number().int().min(1).max(8).default(1),
    adults: z.number().int().min(1).max(9).default(1),
    children: z.number().int().min(0).max(8).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.adults + data.children > 9) {
      ctx.addIssue({ code: "custom", message: "Maximum 9 guests excluding infants.", path: ["adults"] });
    }
    if (data.checkOut <= data.checkIn) {
      ctx.addIssue({ code: "custom", message: "Check-out must be after check-in.", path: ["checkOut"] });
    }
  });

export const hotelSearchFiltersSchema = z.object({
  sort: z.enum(["recommended", "price", "stars"]).optional(),
  refundable: z.boolean().optional(),
  minStars: z.number().int().min(1).max(5).optional(),
  maxPrice: z.number().positive().optional(),
  board: z.string().trim().min(2).max(40).optional(),
});

export function searchRequestFromQuery(query: URLSearchParams) {
  return {
    destination: query.get("city") ?? query.get("to") ?? query.get("destination") ?? "",
    checkIn: query.get("checkIn") ?? "",
    checkOut: query.get("checkOut") ?? "",
    rooms: Number(query.get("rooms") ?? 1),
    adults: Number(query.get("adults") ?? 1),
    children: Number(query.get("children") ?? 0),
  };
}

export function filtersFromQuery(query: URLSearchParams) {
  const refundable = query.get("refundable");
  const minStars = query.get("minStars");
  const maxPrice = query.get("maxPrice");
  return hotelSearchFiltersSchema.parse({
    sort: query.get("sort") ?? undefined,
    refundable: refundable === "true" ? true : refundable === "false" ? false : undefined,
    minStars: minStars ? Number(minStars) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    board: query.get("board") ?? undefined,
  });
}
