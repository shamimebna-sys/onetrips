export const CABIN_CLASSES = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

export const TRIP_TYPES = ["one-way", "round-trip", "multi-city"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export type SearchSegment = {
  origin: string;
  destination: string;
  date: string;
};

export type SearchRequest = {
  tripType: TripType;
  segments: SearchSegment[];
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
};

export type FlightLeg = {
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureAt: string;
  arrivalAt: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  durationLabel: string;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  aircraft: string;
};

export type FlightItinerary = {
  durationMinutes: number;
  durationLabel: string;
  stops: number;
  stopsLabel: string;
  arrivalDayOffset: number;
  segments: FlightLeg[];
};

export type FlightOffer = {
  id: string;
  provider: string;
  cabin: CabinClass;
  cabinLabel: string;
  itineraries: FlightItinerary[];
  fare: {
    currency: string;
    base: number;
    taxes: number;
    total: number;
    totalLabel: string;
    supplierBase?: number;
    supplierTaxes?: number;
    markup?: number;
    serviceFee?: number;
    discount?: number;
    commission?: number;
  };
  baggage: { cabin: string; checked: string };
  refundable: boolean;
  seatsLeft: number;
  brandedFare: string;
  revalidated?: boolean;
  fareRules?: NormalizedFareRule;
  penalties?: NormalizedFareRule["penalties"];
};

export type ProviderSearchResult = {
  offers: FlightOffer[];
  errors: Array<{ provider: string; message: string }>;
};

export type NormalizedFlightOffer = FlightOffer;
export type NormalizedItinerary = FlightItinerary;
export type NormalizedSegment = FlightLeg;
export type NormalizedFare = FlightOffer["fare"];
export type NormalizedBaggage = FlightOffer["baggage"];

export type NormalizedFareRule = {
  offerId: string;
  refundable: boolean;
  changeable: boolean;
  summary: string;
  penalties: Array<{ type: "CHANGE" | "REFUND" | "NOSHOW"; amount: number; currency: string; notes: string }>;
};

export type NormalizedSeatMap = {
  offerId: string;
  segmentIndex: number;
  cabins: Array<{ cabin: string; rows: Array<{ row: number; seats: Array<{ seat: string; available: boolean; type: "WINDOW" | "AISLE" | "MIDDLE" }> }> }>;
};

export type NormalizedProviderStatus =
  | "NOT_FOUND"
  | "PENDING"
  | "CONFIRMED"
  | "TICKETED"
  | "CANCELLED"
  | "FAILED"
  | "UNKNOWN";

export type CreateBookingRequest = {
  bookingId: string;
  bookingRef: string;
  offerId?: string;
  passengerCount?: number;
  correlationId: string;
  idempotencyKey: string;
};

export type CreateBookingResponse = {
  providerRef: string;
  status: "CONFIRMED" | "PENDING" | "UNKNOWN";
  correlationId: string;
};

export type GetBookingStatusRequest = {
  providerRef?: string;
  bookingId?: string;
  idempotencyKey?: string;
  correlationId?: string;
};

export type GetBookingStatusResponse = {
  providerRef: string | null;
  status: NormalizedProviderStatus;
  ticketNumbers: string[];
  correlationId: string;
};

export type IssueTicketRequest = {
  providerRef: string;
  bookingId?: string;
  passengerCount: number;
  correlationId: string;
  idempotencyKey: string;
};

export type IssueTicketResponse = {
  ticketNumbers: string[];
  status: "TICKETED" | "PENDING" | "UNKNOWN";
  correlationId: string;
};

export type VoidTicketRequest = {
  providerRef: string;
  ticketNumber: string;
  bookingId?: string;
  correlationId: string;
  idempotencyKey: string;
};

export type CancelBookingRequest = {
  providerRef: string;
  bookingId?: string;
  correlationId: string;
  idempotencyKey: string;
};

export type ProviderCapabilities = {
  search: boolean;
  revalidate: boolean;
  createBooking: boolean;
  getBookingStatus: boolean;
  issueTicket: boolean;
  voidTicket: boolean;
  cancelBooking: boolean;
  getFareRules: boolean;
  getSeatMap: boolean;
};

export type FlightProviderPort = {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  search(request: SearchRequest): Promise<ProviderSearchResult>;
  revalidate(offer: FlightOffer): Promise<FlightOffer>;
  createBooking(request: CreateBookingRequest): Promise<CreateBookingResponse>;
  getBookingStatus(request: GetBookingStatusRequest): Promise<GetBookingStatusResponse>;
  issueTicket(request: IssueTicketRequest): Promise<IssueTicketResponse>;
  voidTicket(request: VoidTicketRequest): Promise<{ voided: boolean; correlationId: string }>;
  cancelBooking(request: CancelBookingRequest): Promise<{ cancelled: boolean; correlationId: string }>;
  getFareRules(offerId: string): Promise<NormalizedFareRule>;
  getSeatMap(offerId: string, segmentIndex?: number): Promise<NormalizedSeatMap>;
};

export type SearchFilters = {
  sort?: "recommended" | "price" | "duration" | "departure";
  stops?: number[];
  airlines?: string[];
  maxPrice?: number;
  refundable?: boolean;
  departPeriod?: "morning" | "afternoon" | "evening";
  arrivePeriod?: "morning" | "afternoon" | "evening";
  maxDurationMinutes?: number;
  baggage?: boolean;
  fareFamily?: string;
};

export type SearchFacets = {
  minPrice: number;
  maxPrice: number;
  airlines: Array<{ code: string; name: string; count: number; minPrice: number }>;
  stops: Array<{ value: number; label: string; count: number }>;
};

export type SearchSessionView = {
  sessionId: string;
  expiresAt: string;
  request: SearchRequest;
  offers: FlightOffer[];
  total: number;
  facets: SearchFacets;
  errors: Array<{ provider: string; message: string }>;
};

export type SearchSessionRecord = {
  version: 1;
  sessionId: string;
  request: SearchRequest;
  offers: FlightOffer[];
  errors: Array<{ provider: string; message: string }>;
  providerIds: string[];
  createdAt: string;
  expiresAt: string;
};
