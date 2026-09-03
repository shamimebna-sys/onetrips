import { randomUUID } from "node:crypto";
import { prisma } from "@onetrips/database";
import { quoteOffer, quoteOffers, resolveQuoteContext } from "@onetrips/pricing";
import { DomainError } from "@onetrips/shared";
import { getFlightProvider } from "./router";
import { loadSearchSession, saveSearchSession, sessionTtlSeconds } from "./cache";
import { applyFilters, buildFacets } from "./filters";
import { searchFiltersSchema, searchRequestSchema } from "./schemas";
import type { FlightOffer, SearchFilters, SearchRequest, SearchSessionView } from "./types";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function assertDates(request: SearchRequest) {
  const today = todayUtc();
  for (const segment of request.segments) {
    if (segment.origin === segment.destination) {
      throw new DomainError("INVALID_ROUTE", "Origin and destination must be different.");
    }
    if (segment.date < today) {
      throw new DomainError("INVALID_DATE", "Travel dates cannot be in the past.");
    }
  }
  for (let i = 1; i < request.segments.length; i += 1) {
    if (request.segments[i].date < request.segments[i - 1].date) {
      throw new DomainError("INVALID_DATE", "Each later flight must be on or after the previous date.");
    }
  }
}

async function loadAirports(codes: string[]) {
  const unique = [...new Set(codes)];
  const rows = await prisma.airport.findMany({
    where: { isActive: true },
    include: { city: { include: { country: true } } },
  });
  const map = new Map(rows.map((row) => [row.iataCode, {
    iataCode: row.iataCode,
    city: row.city.name,
    country: row.city.country.code,
  }]));
  for (const code of unique) {
    if (!map.has(code)) {
      throw new DomainError("AIRPORT_NOT_FOUND", `Airport ${code} was not found in the catalog.`, 404);
    }
  }
  return map;
}

function getProvider(): ReturnType<typeof getFlightProvider> {
  return getFlightProvider();
}

function toView(record: {
  sessionId: string;
  expiresAt: string;
  request: SearchRequest;
  offers: FlightOffer[];
  errors: Array<{ provider: string; message: string }>;
}, filters: SearchFilters): SearchSessionView {
  const offers = applyFilters(record.offers, filters);
  return {
    sessionId: record.sessionId,
    expiresAt: record.expiresAt,
    request: record.request,
    offers,
    total: offers.length,
    facets: buildFacets(record.offers),
    errors: record.errors,
  };
}

export async function searchFlights(input: unknown, options: { userId?: string } = {}): Promise<SearchSessionView> {
  const request = searchRequestSchema.parse(input);
  assertDates(request);

  const codes = request.segments.flatMap((segment) => [segment.origin, segment.destination]);
  await loadAirports(codes);
  const provider = getProvider();
  const result = await provider.search(request);
  const supplier = await prisma.supplier.findFirst({ where: { type: "GDS", status: "ACTIVE" } });
  const quoteCtx = await resolveQuoteContext(options.userId, supplier?.id);
  const offers = await quoteOffers(result.offers, quoteCtx);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000);

  await prisma.flightSearchSession.create({
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

export async function getSearchSession(sessionId: string, filtersInput: unknown = {}): Promise<SearchSessionView> {
  const filters = searchFiltersSchema.parse(filtersInput ?? {});
  const cached = await loadSearchSession(sessionId);
  if (!cached || new Date(cached.expiresAt) < new Date()) {
    throw new DomainError("SEARCH_EXPIRED", "This search has expired. Please search again.", 410);
  }
  return toView(cached, filters);
}

function hasRefundPenalty(offer: FlightOffer) {
  const penalties = offer.fareRules?.penalties ?? offer.penalties ?? [];
  return penalties.some((row) => row.type === "REFUND" && typeof row.amount === "number" && !Number.isNaN(row.amount));
}

async function attachFareRules(offer: FlightOffer): Promise<FlightOffer> {
  if (!offer.refundable || hasRefundPenalty(offer)) return offer;
  try {
    const fareRules = await getProvider().getFareRules(offer.id);
    return { ...offer, fareRules, penalties: fareRules.penalties };
  } catch {
    return offer;
  }
}

export async function getOffer(sessionId: string, offerId: string): Promise<{ sessionId: string; expiresAt: string; request: SearchRequest; offer: FlightOffer }> {
  const cached = await loadSearchSession(sessionId);
  if (!cached || new Date(cached.expiresAt) < new Date()) {
    throw new DomainError("SEARCH_EXPIRED", "This search has expired. Please search again.", 410);
  }
  const offer = cached.offers.find((row) => row.id === offerId);
  if (!offer) throw new DomainError("OFFER_NOT_FOUND", "That fare is no longer in this search.", 404);
  return { sessionId, expiresAt: cached.expiresAt, request: cached.request, offer: await attachFareRules(offer) };
}

export async function revalidateOffer(sessionId: string, offerId: string) {
  const current = await getOffer(sessionId, offerId);
  await loadAirports(current.request.segments.flatMap((segment) => [segment.origin, segment.destination]));
  const provider = getProvider();
  const raw = await provider.revalidate(current.offer);
  const [supplier, session] = await Promise.all([
    prisma.supplier.findFirst({ where: { type: "GDS", status: "ACTIVE" } }),
    prisma.flightSearchSession.findUnique({ where: { sessionToken: sessionId } }),
  ]);
  const quoteCtx = await resolveQuoteContext(session?.userId ?? undefined, supplier?.id);
  const offer = await quoteOffer(raw, { ...quoteCtx, currency: raw.fare.currency });
  return { ...current, offer };
}
