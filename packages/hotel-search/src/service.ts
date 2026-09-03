import { randomUUID } from "node:crypto";
import { prisma } from "@onetrips/database";
import { quoteOffer, quoteOffers, resolveQuoteContext } from "@onetrips/pricing";
import { DomainError } from "@onetrips/shared";
import { loadSearchSession, saveSearchSession, sessionTtlSeconds } from "./cache";
import { getHotelProvider } from "./router";
import { hotelSearchFiltersSchema, hotelSearchInputSchema } from "./schemas";
import type { HotelOffer, HotelSearchFilters, HotelSearchRequest, HotelSearchSessionView } from "./types";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

async function resolveDestination(destination: string) {
  const q = destination.trim();
  if (/^[A-Za-z]{3}$/.test(q)) {
    const airport = await prisma.airport.findFirst({
      where: { iataCode: q.toUpperCase(), isActive: true },
      include: { city: { include: { country: true } } },
    });
    if (airport) {
      return {
        cityCode: airport.iataCode,
        cityName: airport.city.name,
        countryCode: airport.city.country.code,
      };
    }
  }

  const city = await prisma.city.findFirst({
    where: { name: { contains: q } },
    include: { country: true, airports: { where: { isActive: true }, take: 1, orderBy: { isPopular: "desc" } } },
  });
  const airport = city?.airports[0];
  if (city && airport) {
    return {
      cityCode: airport.iataCode,
      cityName: city.name,
      countryCode: city.country.code,
    };
  }

  throw new DomainError("CITY_NOT_FOUND", "That destination was not found in the catalog.", 404);
}

function applyFilters(offers: HotelOffer[], filters: HotelSearchFilters) {
  let next = offers;
  if (filters.refundable) next = next.filter((row) => row.refundable);
  if (filters.minStars) next = next.filter((row) => row.starRating >= filters.minStars!);
  if (filters.maxPrice) next = next.filter((row) => row.fare.total <= filters.maxPrice!);
  if (filters.board) next = next.filter((row) => row.board.toLowerCase().includes(filters.board!.toLowerCase()));
  if (filters.sort === "price") next = [...next].sort((a, b) => a.fare.total - b.fare.total);
  if (filters.sort === "stars") next = [...next].sort((a, b) => b.starRating - a.starRating || a.fare.total - b.fare.total);
  return next;
}

function toView(
  record: {
    sessionId: string;
    expiresAt: string;
    request: HotelSearchRequest;
    offers: HotelOffer[];
    errors: Array<{ provider: string; message: string }>;
  },
  filters: HotelSearchFilters,
): HotelSearchSessionView {
  const offers = applyFilters(record.offers, filters);
  return {
    sessionId: record.sessionId,
    expiresAt: record.expiresAt,
    request: record.request,
    offers,
    total: offers.length,
    errors: record.errors,
  };
}

export async function searchHotels(input: unknown, options: { userId?: string } = {}): Promise<HotelSearchSessionView> {
  const parsed = hotelSearchInputSchema.parse(input);
  const today = todayUtc();
  if (parsed.checkIn < today) {
    throw new DomainError("INVALID_DATE", "Check-in cannot be in the past.");
  }
  const nights = nightsBetween(parsed.checkIn, parsed.checkOut);
  if (nights < 1) {
    throw new DomainError("INVALID_DATE", "Check-out must be after check-in.");
  }
  if (nights > 30) {
    throw new DomainError("INVALID_DATE", "Stays longer than 30 nights are not supported.");
  }

  const dest = await resolveDestination(parsed.destination);
  const request: HotelSearchRequest = {
    destination: parsed.destination,
    cityCode: dest.cityCode,
    cityName: dest.cityName,
    countryCode: dest.countryCode,
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    rooms: parsed.rooms,
    adults: parsed.adults,
    children: parsed.children,
    infants: 0,
  };

  const provider = getHotelProvider();
  const result = await provider.search(request);
  const supplier = await prisma.supplier.findFirst({ where: { type: "HOTEL", status: "ACTIVE" } });
  const quoteCtx = await resolveQuoteContext(options.userId, supplier?.id);
  const offers = await quoteOffers(result.offers, quoteCtx);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000);

  await prisma.hotelSearchSession.create({
    data: {
      sessionToken: sessionId,
      userId: options.userId,
      searchParams: request,
      providerIds: [provider.id],
      expiresAt,
    },
  });

  await saveSearchSession({
    version: 1,
    sessionId,
    request,
    offers,
    errors: result.errors,
    providerIds: [provider.id],
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return toView(
    {
      sessionId,
      expiresAt: expiresAt.toISOString(),
      request,
      offers,
      errors: result.errors,
    },
    {},
  );
}

export async function getHotelSearchSession(sessionId: string, filtersInput: unknown = {}): Promise<HotelSearchSessionView> {
  const filters = hotelSearchFiltersSchema.parse(filtersInput ?? {});
  const cached = await loadSearchSession(sessionId);
  if (!cached || new Date(cached.expiresAt) < new Date()) {
    throw new DomainError("SEARCH_EXPIRED", "This hotel search has expired. Please search again.", 410);
  }
  return toView(cached, filters);
}

export async function getHotelDetails(sessionId: string, hotelId: string) {
  const cached = await loadSearchSession(sessionId);
  if (!cached || new Date(cached.expiresAt) < new Date()) {
    throw new DomainError("SEARCH_EXPIRED", "This hotel search has expired. Please search again.", 410);
  }
  const offers = cached.offers.filter((row) => row.hotelId === hotelId);
  if (!offers.length) throw new DomainError("HOTEL_NOT_FOUND", "That hotel is no longer in this search.", 404);
  const first = offers[0];
  return {
    sessionId,
    expiresAt: cached.expiresAt,
    request: cached.request,
    hotel: {
      hotelId: first.hotelId,
      name: first.name,
      starRating: first.starRating,
      city: first.city,
      address: first.address,
      amenities: first.amenities,
      board: first.board,
      refundable: first.refundable,
      checkIn: first.checkIn,
      checkOut: first.checkOut,
      nights: first.nights,
      images: first.images ?? [],
      description: first.description ?? null,
      location: first.location ?? { text: first.address },
      cancellationPolicy: first.cancellationPolicy ?? {
        refundable: first.refundable,
        deadline: first.refundable ? first.checkIn : null,
        summary: first.refundable
          ? `Free cancellation until check-in on ${first.checkIn}.`
          : "This rate is non-refundable.",
      },
    },
    rooms: offers,
  };
}

export async function getHotelOffer(sessionId: string, offerId: string) {
  const cached = await loadSearchSession(sessionId);
  if (!cached || new Date(cached.expiresAt) < new Date()) {
    throw new DomainError("SEARCH_EXPIRED", "This hotel search has expired. Please search again.", 410);
  }
  const offer = cached.offers.find((row) => row.id === offerId);
  if (!offer) throw new DomainError("OFFER_NOT_FOUND", "That room is no longer in this search.", 404);
  return { sessionId, expiresAt: cached.expiresAt, request: cached.request, offer };
}

export async function revalidateHotelOffer(sessionId: string, offerId: string) {
  const current = await getHotelOffer(sessionId, offerId);
  const provider = getHotelProvider();
  const raw = await provider.revalidate(current.offer);
  const [supplier, session] = await Promise.all([
    prisma.supplier.findFirst({ where: { type: "HOTEL", status: "ACTIVE" } }),
    prisma.hotelSearchSession.findUnique({ where: { sessionToken: sessionId } }),
  ]);
  const quoteCtx = await resolveQuoteContext(session?.userId ?? undefined, supplier?.id);
  const offer = await quoteOffer(raw, { ...quoteCtx, currency: raw.fare.currency });
  return { ...current, offer };
}
