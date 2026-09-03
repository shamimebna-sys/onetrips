import { ProviderNoAvailabilityError } from "@onetrips/shared";
import type { MockHotelScenario } from "../config";
import type {
  HotelCancelBookingRequest,
  HotelCreateBookingRequest,
  HotelGetBookingStatusRequest,
  HotelIssueVoucherRequest,
  HotelOffer,
  HotelProviderPort,
  HotelSearchRequest,
} from "../types";

type Hold = {
  bookingId: string;
  providerRef: string;
  status: "CONFIRMED" | "CANCELLED";
  voucherNumbers: string[];
};

const holdsByBooking = new Map<string, Hold>();
const holdsByRef = new Map<string, Hold>();

function hash(input: string) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function formatBdt(amount: number) {
  return `৳ ${Math.round(amount).toLocaleString("en-US")}`;
}

function nightsBetween(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

const PROPERTIES = [
  { suffix: "Grand Hotel", stars: 5, board: "Breakfast included", refundable: true, nightly: 11800 },
  { suffix: "Suites", stars: 4, board: "Room only", refundable: true, nightly: 8600 },
  { suffix: "Riverside Inn", stars: 3, board: "Breakfast included", refundable: false, nightly: 5400 },
  { suffix: "Palace", stars: 5, board: "Half board", refundable: true, nightly: 15200 },
] as const;

const ROOMS = [
  { key: "std", name: "Standard King", cabin: "STANDARD", maxOccupancy: 2, bedType: "King", multiplier: 1 },
  { key: "dlx", name: "Deluxe Twin", cabin: "DELUXE", maxOccupancy: 3, bedType: "Twin", multiplier: 1.35 },
] as const;

function quoteShape(cityCode: string, cabin: string) {
  return {
    cabin,
    itineraries: [{ segments: [{ airlineCode: "HT", origin: cityCode, destination: cityCode }] }],
  };
}

function buildOffers(request: HotelSearchRequest): HotelOffer[] {
  const nights = nightsBetween(request.checkIn, request.checkOut);
  const guests = request.adults + request.children;
  const offers: HotelOffer[] = [];
  const seed = hash(`${request.cityCode}:${request.checkIn}:${request.checkOut}`);

  PROPERTIES.forEach((property, propertyIndex) => {
    const hotelId = `htl-${request.cityCode.toLowerCase()}-${propertyIndex + 1}`;
    const name = `${request.cityName} ${property.suffix}`;
    ROOMS.forEach((room) => {
      if (room.maxOccupancy * request.rooms < guests) return;
      const nightly = Math.round(property.nightly * room.multiplier * (1 + (seed % 7) / 50) * (request.cityCode === "DXB" ? 1.45 : 1));
      const supplierBase = nightly * nights * request.rooms;
      const supplierTaxes = Math.round(supplierBase * 0.12);
      const net = supplierBase + supplierTaxes;
      const roomId = `${hotelId}-${room.key}`;
      const images = [
        `https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&sig=${propertyIndex}`,
        `https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&sig=${propertyIndex}`,
        `https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=1200&sig=${propertyIndex}`,
      ];
      offers.push({
        id: roomId,
        provider: "mock-hotel",
        hotelId,
        name,
        starRating: property.stars,
        city: request.cityName,
        cityCode: request.cityCode,
        country: request.countryCode,
        address: `1 ${property.suffix} Road, ${request.cityName}`,
        board: property.board,
        room: { id: roomId, name: room.name, maxOccupancy: room.maxOccupancy, bedType: room.bedType },
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        nights,
        amenities: ["Wi-Fi", "Air conditioning", property.stars >= 4 ? "Pool" : "Restaurant"].filter(Boolean),
        refundable: property.refundable,
        roomsLeft: 2 + ((seed + propertyIndex) % 6),
        cabinLabel: room.name,
        brandedFare: property.board,
        images,
        description: `${name} is in ${request.cityName}, with ${property.board.toLowerCase()} and ${room.name.toLowerCase()} rooms for up to ${room.maxOccupancy} guests.`,
        location: { text: `1 ${property.suffix} Road, ${request.cityName}, ${request.countryCode}` },
        cancellationPolicy: {
          refundable: property.refundable,
          deadline: property.refundable ? request.checkIn : null,
          summary: property.refundable
            ? `Free cancellation until 23:59 on ${request.checkIn}. After that, the first night may be charged.`
            : "This rate is non-refundable. Changes and cancellations are not permitted.",
        },
        fare: {
          currency: "BDT",
          base: supplierBase,
          taxes: supplierTaxes,
          total: net,
          totalLabel: formatBdt(net),
          supplierBase,
          supplierTaxes,
        },
        ...quoteShape(request.cityCode, room.cabin),
      });
    });
  });

  return offers;
}

export function resetMockHotelState() {
  holdsByBooking.clear();
  holdsByRef.clear();
}

export class MockHotelProvider implements HotelProviderPort {
  readonly id = "mock-hotel";

  constructor(private readonly scenario: MockHotelScenario = "SUCCESS") {}

  async search(request: HotelSearchRequest) {
    if (this.scenario === "UNAVAILABLE") {
      return { offers: [] as HotelOffer[], errors: [] as Array<{ provider: string; message: string }> };
    }
    return { offers: buildOffers(request), errors: [] as Array<{ provider: string; message: string }> };
  }

  async revalidate(offer: HotelOffer) {
    if (this.scenario === "UNAVAILABLE") {
      throw new ProviderNoAvailabilityError({ provider: this.id, operation: "revalidate", correlationId: "mock-hotel" });
    }
    if (this.scenario === "PRICE_CHANGED") {
      const supplierBase = Math.round((offer.fare.supplierBase ?? offer.fare.base) * 1.08);
      const supplierTaxes = Math.round((offer.fare.supplierTaxes ?? offer.fare.taxes) * 1.08);
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
          supplierBase,
          supplierTaxes,
        },
      };
    }
    return { ...offer, revalidated: true };
  }

  async createBooking(request: HotelCreateBookingRequest) {
    const existing = holdsByBooking.get(request.bookingId);
    if (existing) {
      return { providerRef: existing.providerRef, status: "CONFIRMED" as const, correlationId: request.correlationId };
    }
    const token = hash(`htl:${request.bookingId}:${request.bookingRef}`).toString(36).toUpperCase().slice(0, 6);
    const providerRef = `HTL${token}`;
    const row: Hold = { bookingId: request.bookingId, providerRef, status: "CONFIRMED", voucherNumbers: [] };
    holdsByBooking.set(request.bookingId, row);
    holdsByRef.set(providerRef, row);
    return { providerRef, status: "CONFIRMED" as const, correlationId: request.correlationId };
  }

  async getBookingStatus(request: HotelGetBookingStatusRequest) {
    const row =
      (request.bookingId ? holdsByBooking.get(request.bookingId) : undefined) ??
      (request.providerRef ? holdsByRef.get(request.providerRef) : undefined);
    if (!row) {
      return {
        providerRef: request.providerRef ?? null,
        status: "NOT_FOUND" as const,
        voucherNumbers: [],
        correlationId: request.correlationId ?? "mock-hotel",
      };
    }
    return {
      providerRef: row.providerRef,
      status: row.status === "CANCELLED" ? ("CANCELLED" as const) : row.voucherNumbers.length ? ("TICKETED" as const) : ("CONFIRMED" as const),
      voucherNumbers: row.voucherNumbers,
      correlationId: request.correlationId ?? "mock-hotel",
    };
  }

  async issueVoucher(request: HotelIssueVoucherRequest) {
    const row = holdsByRef.get(request.providerRef) ?? (request.bookingId ? holdsByBooking.get(request.bookingId) : undefined);
    if (!row) {
      return { voucherNumbers: [], status: "UNKNOWN" as const, correlationId: request.correlationId };
    }
    if (row.voucherNumbers.length === 0) {
      const base = hash(`voucher:${row.bookingId}`).toString(36).toUpperCase().slice(0, 8);
      row.voucherNumbers = Array.from({ length: request.passengerCount }, (_, index) => `HV${base}${index + 1}`.slice(0, 32));
    }
    return { voucherNumbers: row.voucherNumbers, status: "TICKETED" as const, correlationId: request.correlationId };
  }

  async cancelBooking(request: HotelCancelBookingRequest) {
    const row = holdsByRef.get(request.providerRef) ?? (request.bookingId ? holdsByBooking.get(request.bookingId) : undefined);
    if (row) row.status = "CANCELLED";
    return { cancelled: true, correlationId: request.correlationId };
  }
}
