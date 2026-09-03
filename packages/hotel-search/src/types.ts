export type HotelSearchRequest = {
  destination: string;
  cityCode: string;
  cityName: string;
  countryCode: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  infants: number;
};

export type HotelRoom = {
  id: string;
  name: string;
  maxOccupancy: number;
  bedType: string;
};

export type HotelOffer = {
  id: string;
  provider: string;
  hotelId: string;
  name: string;
  starRating: number;
  city: string;
  cityCode: string;
  country: string;
  address: string;
  board: string;
  room: HotelRoom;
  checkIn: string;
  checkOut: string;
  nights: number;
  amenities: string[];
  refundable: boolean;
  roomsLeft: number;
  cabin: string;
  cabinLabel: string;
  brandedFare: string;
  revalidated?: boolean;
  images?: string[];
  description?: string;
  location?: { lat?: number; lng?: number; text?: string };
  cancellationPolicy?: { refundable: boolean; deadline?: string | null; summary: string };
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
  itineraries: Array<{
    segments: Array<{
      airlineCode: string;
      origin: string;
      destination: string;
    }>;
  }>;
};

export type HotelProviderSearchResult = {
  offers: HotelOffer[];
  errors: Array<{ provider: string; message: string }>;
};

export type HotelCreateBookingRequest = {
  bookingId: string;
  bookingRef: string;
  offerId?: string;
  passengerCount?: number;
  correlationId: string;
  idempotencyKey: string;
};

export type HotelCreateBookingResponse = {
  providerRef: string;
  status: "CONFIRMED" | "PENDING" | "UNKNOWN";
  correlationId: string;
};

export type HotelGetBookingStatusRequest = {
  providerRef?: string;
  bookingId?: string;
  idempotencyKey?: string;
  correlationId?: string;
};

export type HotelGetBookingStatusResponse = {
  providerRef: string | null;
  status: "NOT_FOUND" | "PENDING" | "CONFIRMED" | "TICKETED" | "CANCELLED" | "FAILED" | "UNKNOWN";
  voucherNumbers: string[];
  correlationId: string;
};

export type HotelIssueVoucherRequest = {
  providerRef: string;
  bookingId?: string;
  passengerCount: number;
  correlationId: string;
  idempotencyKey: string;
};

export type HotelIssueVoucherResponse = {
  voucherNumbers: string[];
  status: "TICKETED" | "PENDING" | "UNKNOWN";
  correlationId: string;
};

export type HotelCancelBookingRequest = {
  providerRef: string;
  bookingId?: string;
  correlationId: string;
  idempotencyKey: string;
};

export type HotelProviderPort = {
  readonly id: string;
  search(request: HotelSearchRequest): Promise<HotelProviderSearchResult>;
  revalidate(offer: HotelOffer): Promise<HotelOffer>;
  createBooking(request: HotelCreateBookingRequest): Promise<HotelCreateBookingResponse>;
  getBookingStatus(request: HotelGetBookingStatusRequest): Promise<HotelGetBookingStatusResponse>;
  issueVoucher(request: HotelIssueVoucherRequest): Promise<HotelIssueVoucherResponse>;
  cancelBooking(request: HotelCancelBookingRequest): Promise<{ cancelled: boolean; correlationId: string }>;
};

export type HotelSearchFilters = {
  sort?: "recommended" | "price" | "stars";
  refundable?: boolean;
  minStars?: number;
  maxPrice?: number;
  board?: string;
};

export type HotelSearchSessionView = {
  sessionId: string;
  expiresAt: string;
  request: HotelSearchRequest;
  offers: HotelOffer[];
  total: number;
  errors: Array<{ provider: string; message: string }>;
};

export type HotelSearchSessionRecord = {
  version: 1;
  sessionId: string;
  request: HotelSearchRequest;
  offers: HotelOffer[];
  errors: Array<{ provider: string; message: string }>;
  providerIds: string[];
  createdAt: string;
  expiresAt: string;
};
