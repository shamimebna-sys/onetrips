import {
  DomainError,
  ProviderBookingError,
  ProviderCancellationError,
  ProviderNoAvailabilityError,
  ProviderRateLimitError,
  ProviderTicketingError,
  ProviderUnavailableError,
  ProviderUnknownError,
} from "@onetrips/shared";
import type { MockGdsScenario } from "../config";
import { DEFAULT_CAPABILITIES } from "../config";
import type {
  CabinClass,
  CancelBookingRequest,
  CreateBookingRequest,
  FlightItinerary,
  FlightLeg,
  FlightOffer,
  FlightProviderPort,
  GetBookingStatusRequest,
  IssueTicketRequest,
  NormalizedFareRule,
  SearchRequest,
  VoidTicketRequest,
} from "../types";

type AirportRow = {
  iataCode: string;
  city: string;
  country: string;
};

type AirlineRow = {
  iataCode: string;
  name: string;
};

const ROUTE_CARRIERS: Record<string, string[]> = {
  "DAC-CXB": ["BG", "BS", "VQ", "2A"],
  "DAC-CGP": ["BG", "BS", "VQ"],
  "DAC-ZYL": ["BG", "BS"],
  "DAC-JSR": ["BS", "VQ"],
  "DAC-DXB": ["EK", "FZ", "BG", "BS"],
  "DAC-AUH": ["EY", "BG"],
  "DAC-SHJ": ["G9"],
  "DAC-DOH": ["QR", "BG"],
  "DAC-JED": ["SV", "BG", "BS"],
  "DAC-RUH": ["SV", "XY", "BG"],
  "DAC-MED": ["SV", "BG"],
  "DAC-DMM": ["SV", "GF"],
  "DAC-KUL": ["MH", "BG"],
  "DAC-SIN": ["SQ", "BG"],
  "DAC-BKK": ["TG", "BG", "BS"],
  "DAC-DEL": ["AI", "6E", "BG"],
  "DAC-BOM": ["AI", "6E"],
  "DAC-CCU": ["6E", "BG"],
  "DAC-LHR": ["BA", "QR", "EK", "BG"],
  "DAC-IST": ["TK", "BG"],
  "DAC-KTM": ["BG"],
  "DAC-CMB": ["UL", "BG"],
  "DAC-CGK": ["SQ", "MH"],
  "DAC-CAN": ["CZ", "BG"],
};

const AIRCRAFT = ["A320", "A321", "737-800", "A330", "787-8", "777-300ER", "A350-900"];

const CABIN_LABEL: Record<CabinClass, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium Economy",
  BUSINESS: "Business",
  FIRST: "First",
};

const CABIN_MULT: Record<CabinClass, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 1.55,
  BUSINESS: 2.75,
  FIRST: 4.1,
};

const GCC = new Set(["AE", "SA", "QA", "OM", "KW", "BH"]);
const SOUTH_ASIA = new Set(["BD", "IN", "PK", "NP", "LK"]);
const SEA = new Set(["TH", "MY", "SG", "ID"]);
const EUROPE = new Set(["GB", "FR", "DE", "IT", "TR"]);
const AMERICAS = new Set(["US", "CA"]);

function hash(input: string) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function pick<T>(list: T[], seed: number) {
  return list[seed % list.length];
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function clock(iso: string) {
  return iso.slice(11, 16);
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function atDate(date: string, hour: number, minute: number) {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function dayOffset(start: string, end: string) {
  const a = start.slice(0, 10);
  const b = end.slice(0, 10);
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

function routeKey(origin: string, destination: string) {
  return `${origin}-${destination}`;
}

function carriersFor(origin: string, destination: string): string[] {
  return (
    ROUTE_CARRIERS[routeKey(origin, destination)] ??
    ROUTE_CARRIERS[routeKey(destination, origin)] ??
    ["QR", "EK", "TK", "BG", "SQ"]
  );
}

function blockMinutes(origin: AirportRow, destination: AirportRow, seed: number) {
  if (origin.iataCode === destination.iataCode) return 60;
  if (origin.country === destination.country) {
    if (
      (origin.iataCode === "DAC" && destination.iataCode === "CXB") ||
      (origin.iataCode === "CXB" && destination.iataCode === "DAC")
    ) {
      return 55;
    }
    return 50 + (seed % 35);
  }
  if (GCC.has(origin.country) && GCC.has(destination.country)) return 75 + (seed % 40);
  if (
    (origin.country === "BD" && GCC.has(destination.country)) ||
    (destination.country === "BD" && GCC.has(origin.country))
  ) {
    return 310 + (seed % 80);
  }
  if (SOUTH_ASIA.has(origin.country) && SOUTH_ASIA.has(destination.country)) return 130 + (seed % 70);
  if (
    (origin.country === "BD" && SEA.has(destination.country)) ||
    (destination.country === "BD" && SEA.has(origin.country))
  ) {
    return 210 + (seed % 70);
  }
  if (
    (origin.country === "BD" && EUROPE.has(destination.country)) ||
    (destination.country === "BD" && EUROPE.has(origin.country))
  ) {
    return 560 + (seed % 160);
  }
  if (
    (origin.country === "BD" && AMERICAS.has(destination.country)) ||
    (destination.country === "BD" && AMERICAS.has(origin.country))
  ) {
    return 980 + (seed % 160);
  }
  return 420 + (seed % 220);
}

function baseFare(origin: AirportRow, destination: AirportRow, seed: number) {
  if (origin.country === destination.country) return 4200 + (seed % 2800);
  if (
    (origin.country === "BD" && GCC.has(destination.country)) ||
    (destination.country === "BD" && GCC.has(origin.country))
  ) {
    return 28000 + (seed % 18000);
  }
  if (SOUTH_ASIA.has(origin.country) && SOUTH_ASIA.has(destination.country)) return 12000 + (seed % 8000);
  if (
    (origin.country === "BD" && SEA.has(destination.country)) ||
    (destination.country === "BD" && SEA.has(origin.country))
  ) {
    return 22000 + (seed % 14000);
  }
  if (
    (origin.country === "BD" && EUROPE.has(destination.country)) ||
    (destination.country === "BD" && EUROPE.has(origin.country))
  ) {
    return 62000 + (seed % 28000);
  }
  if (
    (origin.country === "BD" && AMERICAS.has(destination.country)) ||
    (destination.country === "BD" && AMERICAS.has(origin.country))
  ) {
    return 98000 + (seed % 40000);
  }
  return 36000 + (seed % 24000);
}

function formatBdt(amount: number) {
  return `৳ ${Math.round(amount).toLocaleString("en-US")}`;
}

function passengerMultiplier(request: SearchRequest) {
  return request.adults + request.children * 0.75 + request.infants * 0.1;
}

function makeLeg(params: {
  origin: AirportRow;
  destination: AirportRow;
  airline: AirlineRow;
  departureAt: string;
  minutes: number;
  seed: number;
}): FlightLeg {
  const arrivalAt = addMinutes(params.departureAt, params.minutes);
  return {
    origin: params.origin.iataCode,
    originCity: params.origin.city,
    destination: params.destination.iataCode,
    destinationCity: params.destination.city,
    departureAt: params.departureAt,
    arrivalAt,
    departureTime: clock(params.departureAt),
    arrivalTime: clock(arrivalAt),
    durationMinutes: params.minutes,
    durationLabel: durationLabel(params.minutes),
    airlineCode: params.airline.iataCode,
    airlineName: params.airline.name,
    flightNumber: `${params.airline.iataCode}${100 + (params.seed % 800)}`,
    aircraft: pick(AIRCRAFT, params.seed),
  };
}

function makeItinerary(segments: FlightLeg[]): FlightItinerary {
  const durationMinutes = segments.reduce((sum, leg, index) => {
    if (index === 0) return leg.durationMinutes;
    const layover = Math.max(
      0,
      Math.round((new Date(leg.departureAt).getTime() - new Date(segments[index - 1].arrivalAt).getTime()) / 60_000),
    );
    return sum + layover + leg.durationMinutes;
  }, 0);
  const stops = Math.max(0, segments.length - 1);
  return {
    durationMinutes,
    durationLabel: durationLabel(durationMinutes),
    stops,
    stopsLabel: stops === 0 ? "Non-stop" : stops === 1 ? "1 stop" : `${stops} stops`,
    arrivalDayOffset: dayOffset(segments[0].departureAt, segments[segments.length - 1].arrivalAt),
    segments,
  };
}

function fareFor(
  request: SearchRequest,
  origin: AirportRow,
  destination: AirportRow,
  seed: number,
  stopPenalty: number,
) {
  const base = Math.round(baseFare(origin, destination, seed) * CABIN_MULT[request.cabin] * passengerMultiplier(request) + stopPenalty);
  const taxes = Math.round(base * 0.18);
  const total = base + taxes;
  return {
    currency: "BDT",
    base,
    taxes,
    total,
    totalLabel: formatBdt(total),
  };
}

function baggage(cabin: CabinClass) {
  if (cabin === "BUSINESS" || cabin === "FIRST") return { cabin: "12 kg", checked: "40 kg" };
  if (cabin === "PREMIUM_ECONOMY") return { cabin: "10 kg", checked: "30 kg" };
  return { cabin: "7 kg", checked: "20 kg" };
}

function brandedFare(cabin: CabinClass, refundable: boolean) {
  if (cabin === "BUSINESS" || cabin === "FIRST") return "Flex";
  return refundable ? "Flex" : "Value";
}

const MOCK_CHANGE_FEE = 2500;

export function mockFareRules(offerId: string, refundable: boolean): NormalizedFareRule {
  const penalties: NormalizedFareRule["penalties"] = [
    { type: "CHANGE", amount: MOCK_CHANGE_FEE, currency: "BDT", notes: "Mock change fee" },
  ];
  if (refundable) {
    penalties.push({ type: "REFUND", amount: MOCK_CHANGE_FEE, currency: "BDT", notes: "Mock cancellation fee" });
  }
  return {
    offerId,
    refundable,
    changeable: true,
    summary: refundable
      ? "Mock fare rules. Change and refund permitted before departure with a fee."
      : "Mock fare rules. This fare is non-refundable.",
    penalties,
  };
}

function withFareRules(offer: FlightOffer): FlightOffer {
  const fareRules = mockFareRules(offer.id, offer.refundable);
  return { ...offer, fareRules, penalties: fareRules.penalties };
}

type MockPnr = {
  bookingId: string;
  providerRef: string;
  status: "CONFIRMED" | "TICKETED" | "CANCELLED" | "FAILED";
  ticketNumbers: string[];
};

const pnrsByBooking = new Map<string, MockPnr>();
const pnrsByRef = new Map<string, MockPnr>();

export function resetMockProviderState() {
  pnrsByBooking.clear();
  pnrsByRef.clear();
}

function hang() {
  return new Promise<never>(() => {
    /* resolved only by the timeout wrapper */
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockFlightProvider implements FlightProviderPort {
  readonly id = "mock-gds";
  readonly capabilities = DEFAULT_CAPABILITIES;

  constructor(
    private airports: Map<string, AirportRow>,
    private airlines: Map<string, AirlineRow>,
    private readonly scenario: MockGdsScenario = "SUCCESS",
  ) {}

  private async ensureCatalog() {
    if (this.airports.size > 0) return;
    const { prisma } = await import("@onetrips/database");
    const [airports, airlines] = await Promise.all([
      prisma.airport.findMany({ where: { isActive: true }, include: { city: { include: { country: true } } } }),
      prisma.airline.findMany({ where: { isActive: true } }),
    ]);
    this.airports = new Map(airports.map((row) => [row.iataCode, { iataCode: row.iataCode, city: row.city.name, country: row.city.country.code }]));
    this.airlines = new Map(airlines.map((row) => [row.iataCode, { iataCode: row.iataCode, name: row.name }]));
  }

  async search(request: SearchRequest) {
    await this.ensureCatalog();
    if (this.scenario === "TIMEOUT") return hang();
    if (this.scenario === "RATE_LIMIT") {
      throw new ProviderRateLimitError({ provider: this.id, operation: "search", correlationId: "mock" });
    }
    if (this.scenario === "UNAVAILABLE") {
      throw new ProviderUnavailableError({ provider: this.id, operation: "search", correlationId: "mock" });
    }
    if (this.scenario === "MALFORMED_RESPONSE") {
      throw new ProviderUnknownError({ provider: this.id, operation: "search", correlationId: "mock", providerErrorCode: "MALFORMED" });
    }
    await delay(20);
    const offers =
      request.tripType === "round-trip"
        ? this.roundTrip(request)
        : request.tripType === "multi-city"
          ? this.multiCity(request)
          : this.oneWay(request, request.segments[0]);
    return { offers, errors: [] as Array<{ provider: string; message: string }> };
  }

  async revalidate(offer: FlightOffer) {
    if (this.scenario === "TIMEOUT") return hang();
    if (this.scenario === "UNAVAILABLE") {
      throw new ProviderNoAvailabilityError({ provider: this.id, operation: "revalidate", correlationId: "mock" });
    }
    if (this.scenario === "PRICE_CHANGED") {
      const supplierBase = Math.round((offer.fare.supplierBase ?? offer.fare.base) * 1.06);
      const supplierTaxes = Math.round((offer.fare.supplierTaxes ?? offer.fare.taxes) * 1.06);
      const net = supplierBase + supplierTaxes;
      return {
        ...offer,
        revalidated: true,
        fare: {
          currency: offer.fare.currency,
          base: supplierBase,
          taxes: supplierTaxes,
          total: net,
          totalLabel: formatBdt(net),
        },
      };
    }
    return { ...offer, revalidated: true };
  }

  async createBooking(request: CreateBookingRequest) {
    const existing = pnrsByBooking.get(request.bookingId);
    if (existing) {
      return { providerRef: existing.providerRef, status: "CONFIRMED" as const, correlationId: request.correlationId };
    }
    if (this.scenario === "TIMEOUT") return hang();
    if (this.scenario === "BOOKING_FAILURE") {
      throw new ProviderBookingError({ provider: this.id, operation: "createBooking", correlationId: request.correlationId, providerErrorCode: "MOCK_FAIL" });
    }
    const token = hash(`pnr:${request.bookingId}:${request.bookingRef}`).toString(36).toUpperCase().slice(0, 6);
    const providerRef = `MCK${token}`;
    const row: MockPnr = { bookingId: request.bookingId, providerRef, status: "CONFIRMED", ticketNumbers: [] };
    pnrsByBooking.set(request.bookingId, row);
    pnrsByRef.set(providerRef, row);
    if (this.scenario === "BOOKING_TIMEOUT") return hang();
    return { providerRef, status: "CONFIRMED" as const, correlationId: request.correlationId };
  }

  async getBookingStatus(request: GetBookingStatusRequest) {
    const row =
      (request.bookingId ? pnrsByBooking.get(request.bookingId) : undefined) ??
      (request.providerRef ? pnrsByRef.get(request.providerRef) : undefined);
    if (!row) {
      return {
        providerRef: request.providerRef ?? null,
        status: "NOT_FOUND" as const,
        ticketNumbers: [],
        correlationId: request.correlationId ?? "mock",
      };
    }
    return {
      providerRef: row.providerRef,
      status: row.status,
      ticketNumbers: row.ticketNumbers,
      correlationId: request.correlationId ?? "mock",
    };
  }

  async issueTicket(request: IssueTicketRequest) {
    const row = pnrsByRef.get(request.providerRef) ?? (request.bookingId ? pnrsByBooking.get(request.bookingId) : undefined);
    if (!row) {
      throw new ProviderTicketingError({ provider: this.id, operation: "issueTicket", correlationId: request.correlationId, providerErrorCode: "NO_PNR" });
    }
    if (row.ticketNumbers.length > 0) {
      return { ticketNumbers: row.ticketNumbers, status: "TICKETED" as const, correlationId: request.correlationId };
    }
    if (this.scenario === "TIMEOUT") return hang();
    if (this.scenario === "TICKETING_FAILURE") {
      throw new ProviderTicketingError({ provider: this.id, operation: "issueTicket", correlationId: request.correlationId, providerErrorCode: "MOCK_FAIL" });
    }
    const count = Math.max(1, Math.min(9, request.passengerCount));
    row.ticketNumbers = Array.from({ length: count }, (_, index) => {
      const digits = String(hash(`${row.providerRef}:${index}`)).padStart(10, "0").slice(0, 10);
      return `147${digits}`;
    });
    row.status = "TICKETED";
    if (this.scenario === "TICKETING_TIMEOUT") return hang();
    return { ticketNumbers: row.ticketNumbers, status: "TICKETED" as const, correlationId: request.correlationId };
  }

  async voidTicket(request: VoidTicketRequest) {
    if (this.scenario === "VOID_FAILURE") {
      throw new ProviderTicketingError({ provider: this.id, operation: "voidTicket", correlationId: request.correlationId, providerErrorCode: "VOID_FAIL" });
    }
    const row = pnrsByRef.get(request.providerRef);
    if (row) {
      row.ticketNumbers = row.ticketNumbers.filter((number) => number !== request.ticketNumber);
    }
    return { voided: true, correlationId: request.correlationId };
  }

  async cancelBooking(request: CancelBookingRequest) {
    if (!request.providerRef.trim()) {
      throw new DomainError("MISSING_PNR", "A supplier PNR is required to cancel.", 400);
    }
    if (this.scenario === "TIMEOUT") return hang();
    if (this.scenario === "CANCEL_FAILURE") {
      throw new ProviderCancellationError({ provider: this.id, operation: "cancelBooking", correlationId: request.correlationId, providerErrorCode: "CANCEL_FAIL" });
    }
    const row = pnrsByRef.get(request.providerRef) ?? (request.bookingId ? pnrsByBooking.get(request.bookingId) : undefined);
    if (row) row.status = "CANCELLED";
    if (this.scenario === "CANCEL_TIMEOUT") return hang();
    return { cancelled: true, correlationId: request.correlationId };
  }

  async getFareRules(offerId: string) {
    return mockFareRules(offerId, true);
  }

  async getSeatMap(offerId: string, segmentIndex = 0) {
    return {
      offerId,
      segmentIndex,
      cabins: [
        {
          cabin: "ECONOMY",
          rows: [1, 2].map((row) => ({
            row,
            seats: ["A", "B", "C", "D"].map((seat) => ({
              seat: `${row}${seat}`,
              available: true,
              type: seat === "A" || seat === "D" ? ("WINDOW" as const) : seat === "C" ? ("AISLE" as const) : ("MIDDLE" as const),
            })),
          })),
        },
      ],
    };
  }

  private airport(code: string) {
    const row = this.airports.get(code);
    if (!row) throw new DomainError("AIRPORT_NOT_FOUND", `Unknown airport ${code}.`, 404);
    return row;
  }

  private airline(code: string): AirlineRow {
    return this.airlines.get(code) ?? { iataCode: code, name: code };
  }

  private oneWay(request: SearchRequest, segment: SearchRequest["segments"][number], idPrefix = "ow") {
    const origin = this.airport(segment.origin);
    const destination = this.airport(segment.destination);
    const carriers = carriersFor(origin.iataCode, destination.iataCode);
    const offers: FlightOffer[] = [];
    const templates: Array<{ stops: 0 | 1 | 2; hour: number }> = [
      { stops: 0, hour: 7 },
      { stops: 0, hour: 13 },
      { stops: 0, hour: 19 },
      { stops: 1, hour: 9 },
      { stops: 1, hour: 16 },
      { stops: 2, hour: 8 },
    ];

    templates.forEach((template, index) => {
      const carrierCode = carriers[index % carriers.length];
      const airline = this.airline(carrierCode);
      const seed = hash(`${this.id}:${origin.iataCode}${destination.iataCode}:${segment.date}:${carrierCode}:${index}:${request.cabin}`);
      const minute = seed % 50;
      const flyMinutes = blockMinutes(origin, destination, seed);
      if (template.stops >= 2 && flyMinutes < 300) return;

      const departureAt = atDate(segment.date, template.hour + (seed % 3), minute);
      let itinerary: FlightItinerary;

      if (template.stops === 0) {
        itinerary = makeItinerary([
          makeLeg({ origin, destination, airline, departureAt, minutes: flyMinutes, seed }),
        ]);
      } else {
        const viaCodes = ["DOH", "DXB", "IST", "SIN", "BKK"].filter(
          (code) => code !== origin.iataCode && code !== destination.iataCode,
        );
        const via = this.airports.get(viaCodes[seed % viaCodes.length] ?? "DOH") ?? this.airports.get("DXB");
        if (!via) {
          itinerary = makeItinerary([
            makeLeg({ origin, destination, airline, departureAt, minutes: flyMinutes, seed }),
          ]);
        } else if (template.stops === 1) {
          const first = makeLeg({
            origin,
            destination: via,
            airline,
            departureAt,
            minutes: Math.round(flyMinutes * 0.55),
            seed,
          });
          const secondDep = addMinutes(first.arrivalAt, 80 + (seed % 70));
          const second = makeLeg({
            origin: via,
            destination,
            airline,
            departureAt: secondDep,
            minutes: Math.round(flyMinutes * 0.6),
            seed: seed + 17,
          });
          itinerary = makeItinerary([first, second]);
        } else {
          const midCodes = viaCodes.filter((code) => code !== via.iataCode);
          const mid = this.airports.get(midCodes[0] ?? "SIN") ?? via;
          const first = makeLeg({
            origin,
            destination: via,
            airline,
            departureAt,
            minutes: Math.round(flyMinutes * 0.4),
            seed,
          });
          const secondDep = addMinutes(first.arrivalAt, 70 + (seed % 50));
          const second = makeLeg({
            origin: via,
            destination: mid,
            airline,
            departureAt: secondDep,
            minutes: Math.round(flyMinutes * 0.35),
            seed: seed + 9,
          });
          const thirdDep = addMinutes(second.arrivalAt, 65 + (seed % 40));
          const third = makeLeg({
            origin: mid,
            destination,
            airline,
            departureAt: thirdDep,
            minutes: Math.round(flyMinutes * 0.4),
            seed: seed + 21,
          });
          itinerary = makeItinerary([first, second, third]);
        }
      }

      const refundable = request.cabin !== "ECONOMY" || seed % 3 === 0;
      const stopPenalty = itinerary.stops === 0 ? 1800 : itinerary.stops === 1 ? -3500 : -7200;
      offers.push(
        withFareRules({
          id: `${this.id}:${idPrefix}:${segment.origin}${segment.destination}:${segment.date}:${index}`,
          provider: this.id,
          cabin: request.cabin,
          cabinLabel: CABIN_LABEL[request.cabin],
          itineraries: [itinerary],
          fare: fareFor(request, origin, destination, seed, stopPenalty),
          baggage: baggage(request.cabin),
          refundable,
          seatsLeft: 2 + (seed % 8),
          brandedFare: brandedFare(request.cabin, refundable),
        }),
      );
    });

    return offers;
  }

  private roundTrip(request: SearchRequest) {
    const outbound = this.oneWay(request, request.segments[0], "ob");
    const inbound = this.oneWay(request, request.segments[1], "ib");
    const pairs: FlightOffer[] = [];

    outbound.slice(0, 5).forEach((out, index) => {
      const match =
        inbound.find((row) => row.itineraries[0].segments[0].airlineCode === out.itineraries[0].segments[0].airlineCode) ??
        inbound[index % inbound.length];
      const total = out.fare.total + match.fare.total;
      const base = out.fare.base + match.fare.base;
      const taxes = out.fare.taxes + match.fare.taxes;
      pairs.push(
        withFareRules({
          id: `${this.id}:rt:${request.segments[0].origin}${request.segments[0].destination}:${index}`,
          provider: this.id,
          cabin: request.cabin,
          cabinLabel: CABIN_LABEL[request.cabin],
          itineraries: [out.itineraries[0], match.itineraries[0]],
          fare: {
            currency: "BDT",
            base,
            taxes,
            total,
            totalLabel: formatBdt(total),
          },
          baggage: out.baggage,
          refundable: out.refundable && match.refundable,
          seatsLeft: Math.min(out.seatsLeft, match.seatsLeft),
          brandedFare: out.brandedFare,
        }),
      );
    });

    return pairs;
  }

  private multiCity(request: SearchRequest) {
    const perSegment = request.segments.map((segment, index) => this.oneWay(request, segment, `mc${index}`).slice(0, 3));
    const combos = [0, 1, 2, 1];
    return combos.map((choice, index) => {
      const parts = perSegment.map((options) => options[Math.min(choice, options.length - 1)]);
      const itineraries = parts.map((part) => part.itineraries[0]);
      const total = parts.reduce((sum, part) => sum + part.fare.total, 0);
      const base = parts.reduce((sum, part) => sum + part.fare.base, 0);
      const taxes = parts.reduce((sum, part) => sum + part.fare.taxes, 0);
      return withFareRules({
        id: `${this.id}:mc:${index}`,
        provider: this.id,
        cabin: request.cabin,
        cabinLabel: CABIN_LABEL[request.cabin],
        itineraries,
        fare: { currency: "BDT", base, taxes, total, totalLabel: formatBdt(total) },
        baggage: parts[0].baggage,
        refundable: parts.every((part) => part.refundable),
        seatsLeft: Math.min(...parts.map((part) => part.seatsLeft)),
        brandedFare: parts[0].brandedFare,
      });
    });
  }
}
