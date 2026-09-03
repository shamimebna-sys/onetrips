import type { FlightOffer, SearchFacets, SearchFilters } from "./types";

function departHour(offer: FlightOffer) {
  return Number(offer.itineraries[0]?.segments[0]?.departureTime.slice(0, 2) ?? 0);
}

function maxStops(offer: FlightOffer) {
  return Math.max(0, ...offer.itineraries.map((row) => row.stops));
}

function durationScore(offer: FlightOffer) {
  return offer.itineraries.reduce((sum, row) => sum + row.durationMinutes, 0);
}

function inPeriod(hour: number, period?: SearchFilters["departPeriod"]) {
  if (!period) return true;
  if (period === "morning") return hour < 12;
  if (period === "afternoon") return hour >= 12 && hour < 18;
  return hour >= 18;
}

function arriveHour(offer: FlightOffer) {
  const last = offer.itineraries[0]?.segments[offer.itineraries[0].segments.length - 1];
  return Number(last?.arrivalTime.slice(0, 2) ?? 0);
}

export function applyFilters(offers: FlightOffer[], filters: SearchFilters) {
  let rows = offers.filter((offer) => {
    if (filters.stops?.length && !filters.stops.includes(maxStops(offer))) return false;
    if (filters.airlines?.length) {
      const codes = new Set(offer.itineraries.flatMap((row) => row.segments.map((leg) => leg.airlineCode)));
      if (!filters.airlines.some((code) => codes.has(code))) return false;
    }
    if (filters.maxPrice && offer.fare.total > filters.maxPrice) return false;
    if (filters.refundable && !offer.refundable) return false;
    if (!inPeriod(departHour(offer), filters.departPeriod)) return false;
    if (!inPeriod(arriveHour(offer), filters.arrivePeriod)) return false;
    if (filters.maxDurationMinutes && durationScore(offer) > filters.maxDurationMinutes) return false;
    if (filters.baggage && !offer.baggage.checked) return false;
    if (filters.fareFamily && offer.brandedFare.toLowerCase() !== filters.fareFamily.toLowerCase()) return false;
    return true;
  });

  const sort = filters.sort ?? "recommended";
  rows = [...rows].sort((a, b) => {
    if (sort === "price") return a.fare.total - b.fare.total;
    if (sort === "duration") return durationScore(a) - durationScore(b);
    if (sort === "departure") return a.itineraries[0].segments[0].departureAt.localeCompare(b.itineraries[0].segments[0].departureAt);
    return a.fare.total * 0.7 + durationScore(a) * 8 - (b.fare.total * 0.7 + durationScore(b) * 8);
  });

  return rows;
}

export function buildFacets(offers: FlightOffer[]): SearchFacets {
  const airlineMap = new Map<string, { code: string; name: string; count: number; minPrice: number }>();
  const stopCounts = new Map<number, number>();
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;

  for (const offer of offers) {
    minPrice = Math.min(minPrice, offer.fare.total);
    maxPrice = Math.max(maxPrice, offer.fare.total);
    const stops = maxStops(offer);
    stopCounts.set(stops, (stopCounts.get(stops) ?? 0) + 1);
    const first = offer.itineraries[0]?.segments[0];
    if (!first) continue;
    const current = airlineMap.get(first.airlineCode) ?? {
      code: first.airlineCode,
      name: first.airlineName,
      count: 0,
      minPrice: offer.fare.total,
    };
    current.count += 1;
    current.minPrice = Math.min(current.minPrice, offer.fare.total);
    airlineMap.set(first.airlineCode, current);
  }

  return {
    minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    maxPrice,
    airlines: [...airlineMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    stops: [0, 1, 2].map((value) => ({
      value,
      label: value === 0 ? "Non-stop" : value === 1 ? "1 stop" : "2+ stops",
      count: stopCounts.get(value) ?? 0,
    })),
  };
}
