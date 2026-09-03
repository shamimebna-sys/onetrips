import { formatFareMoney, refundPresentation, type RefundableOffer } from "@/lib/flightRefund";
import { isActiveFareHoldState, timelineMarker, type TimelineMarker } from "@onetrips/shared";

export type PassengerForm = {
  type: "ADULT" | "CHILD" | "INFANT";
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
};

export type BookingOffer = {
  cabinLabel: string;
  brandedFare: string;
  refundable: boolean;
  previousTotal?: number;
  fare: {
    total: number;
    totalLabel: string;
    base: number;
    taxes: number;
    markup?: number;
    serviceFee?: number;
    discount?: number;
    currency?: string;
  };
  fareRules?: { penalties?: Array<{ type: "CHANGE" | "REFUND" | "NOSHOW"; amount: number }> };
  penalties?: Array<{ type: "CHANGE" | "REFUND" | "NOSHOW"; amount: number }>;
  baggage: { cabin: string; checked: string };
  itineraries?: Array<{
    durationLabel: string;
    stopsLabel: string;
    segments: Array<{
      origin: string;
      originCity: string;
      destination: string;
      destinationCity: string;
      departureTime: string;
      arrivalTime: string;
      airlineName: string;
      flightNumber: string;
    }>;
  }>;
};

export type Booking = {
  id: string;
  bookingRef: string;
  status: string;
  type?: string;
  totalAmount: number;
  currency: string;
  expiresAt: string | null;
  quotedTotal: number;
  providerRef: string | null;
  contact: { email?: string; phone?: string } | null;
  hotel?: {
    name: string;
    starRating: number;
    city: string;
    address: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    room: { name: string; bedType: string };
    board: string;
  } | null;
  next: {
    canAcceptPrice: boolean;
    canSavePassengers: boolean;
    canPay: boolean;
    awaitingPayment?: boolean;
    paid?: boolean;
    canIssueTickets?: boolean;
    issuingTickets?: boolean;
    ticketed?: boolean;
    searchAgain: boolean;
    canCancel?: boolean;
    canRefund?: boolean;
    cancelled?: boolean;
    refunded?: boolean;
  };
  request: {
    adults: number;
    children: number;
    infants: number;
    cabin: string;
    tripType?: string;
    segments?: Array<{ origin: string; destination: string; date: string }>;
    checkIn?: string;
    checkOut?: string;
  };
  offer: BookingOffer | null;
  passengers: Array<{ id: string; type: string; firstName: string; lastName: string; ticketNumber?: string | null }>;
  payments?: Array<{
    id: string;
    status: string;
    method: string | null;
    amount: number;
    currency: string;
    providerRef?: string | null;
    createdAt?: string;
  }>;
  tickets?: Array<{ id: string; ticketNumber: string; status: string; passengerId: string | null; pdfUrl: string }>;
  invoices?: Array<{ id: string; invoiceNo: string; status: string; total: number; currency: string; pdfUrl: string }>;
  segments?: Array<{ origin: string; destination: string; sequenceNo?: number }>;
  history: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; at: string }>;
};

export const CARD =
  "rounded-[14px] border border-line bg-white p-5 shadow-[0_4px_16px_rgba(16,23,42,0.04)] md:p-6";
export const LABEL = "text-[10px] font-bold uppercase tracking-[0.16em] text-copy-muted";
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2";
export const FIELD =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-navy outline-none transition-colors placeholder:text-copy-muted/60 focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-field disabled:text-copy-muted";
export const FIELD_ERROR = "border-red-300 focus:border-red-400 focus:ring-red-200";

export function slotsFor(request: Booking["request"]): PassengerForm[] {
  const rows: PassengerForm[] = [];
  const push = (type: PassengerForm["type"], count: number) => {
    for (let i = 0; i < count; i += 1) {
      rows.push({
        type,
        title: "",
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        nationality: "",
        passportNumber: "",
        passportExpiry: "",
      });
    }
  };
  push("ADULT", request.adults);
  push("CHILD", request.children);
  push("INFANT", request.infants);
  return rows;
}

export function passengerHeading(passengers: PassengerForm[], index: number) {
  const row = passengers[index];
  const labels = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" } as const;
  const type = row?.type ?? "ADULT";
  const n = passengers.slice(0, index + 1).filter((item) => item.type === type).length;
  return `${labels[type]} ${n}`;
}

export function passengerSummary(request: Booking["request"]) {
  const parts: string[] = [];
  if (request.adults) parts.push(`${request.adults} Adult${request.adults === 1 ? "" : "s"}`);
  if (request.children) parts.push(`${request.children} Child${request.children === 1 ? "" : "ren"}`);
  if (request.infants) parts.push(`${request.infants} Infant${request.infants === 1 ? "" : "s"}`);
  return parts.join(" · ") || "—";
}

function joinAirportCodes(segments: Array<{ origin: string; destination: string }>) {
  const codes: string[] = [];
  for (const leg of segments) {
    if (leg.origin && codes[codes.length - 1] !== leg.origin) codes.push(leg.origin);
    if (leg.destination) codes.push(leg.destination);
  }
  return codes.join(" → ");
}

export function itineraryRoute(itinerary: NonNullable<BookingOffer["itineraries"]>[number]) {
  return joinAirportCodes(itinerary.segments) || "—";
}

export function bookingRoute(booking: Booking) {
  const itineraries = booking.offer?.itineraries ?? [];
  if (itineraries.length > 0) {
    return joinAirportCodes(itineraries.flatMap((row) => row.segments)) || "—";
  }
  if (booking.segments && booking.segments.length > 0) {
    return joinAirportCodes([...booking.segments].sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0))) || "—";
  }
  if (booking.hotel) return booking.hotel.city;
  if (booking.request.segments && booking.request.segments.length > 0) {
    return joinAirportCodes(booking.request.segments);
  }
  return "—";
}

export function formatTravelDate(value?: string | null) {
  if (!value) return "";
  const iso = value.length > 10 ? value.slice(0, 10) : value;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function bookingTravelDate(booking: Booking) {
  if (booking.hotel) return formatTravelDate(booking.hotel.checkIn);
  const fromRequest = booking.request.segments?.[0]?.date;
  if (fromRequest) return formatTravelDate(fromRequest);
  return "";
}

export function fareBreakdownRows(fare: BookingOffer["fare"]) {
  const rows: Array<{ label: string; amount: number }> = [
    { label: "Supplier / base fare", amount: fare.base },
    { label: "Taxes", amount: fare.taxes },
    { label: "Markup", amount: fare.markup ?? 0 },
    { label: "Service fee", amount: fare.serviceFee ?? 0 },
    { label: "Discount", amount: -(fare.discount ?? 0) },
  ];
  return rows.filter((row) => row.amount !== 0);
}

export function offerRefund(offer: BookingOffer, currency: string) {
  return refundPresentation({
    refundable: offer.refundable,
    fare: {
      currency,
      total: offer.fare.total,
      totalLabel: offer.fare.totalLabel,
    },
    fareRules: offer.fareRules,
    penalties: offer.penalties,
  } satisfies RefundableOffer);
}

export function refundDisplay(refund: ReturnType<typeof refundPresentation>) {
  const pending = refund.amountText === "Unavailable" || refund.feeText === "Unavailable";
  return {
    ...refund,
    pending,
    amountText: pending ? "Confirming fare rules…" : refund.amountText,
    feeText: pending ? "Confirming fare rules…" : refund.feeText,
  };
}

export function money(currency: string, amount: number) {
  return formatFareMoney(currency, amount);
}

export function passportRequiredFor(booking: Booking) {
  return booking.type !== "HOTEL";
}

export type ProgressStep = 0 | 1 | 2 | 3;

export function progressIndex(booking: Booking): ProgressStep {
  const { status, next } = booking;
  if (
    next.ticketed ||
    status === "TICKETED" ||
    status === "BOOKED" ||
    status === "TICKETING_PENDING" ||
    status === "TICKETING_FAILED" ||
    status === "TICKETING_UNKNOWN" ||
    status === "BOOKING_UNKNOWN" ||
    status === "PAYMENT_SUCCESS" ||
    status === "BOOKING_PENDING" ||
    status === "BOOKING_FAILED" ||
    status === "CANCELLED" ||
    status === "REFUND_PENDING" ||
    status === "REFUNDED"
  ) {
    return 3;
  }
  if (
    next.canPay ||
    next.awaitingPayment ||
    status === "PAYMENT_PENDING" ||
    status === "PAYMENT_PROCESSING" ||
    status === "PAYMENT_FAILED"
  ) {
    return 2;
  }
  if (next.searchAgain || status === "UNAVAILABLE" || status === "EXPIRED") {
    return 0;
  }
  return 1;
}

export function holdRemainingMs(expiresAt: string | null, now: number) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return end - now;
}

/** Unpaid fare-hold chrome only — ticketed/paid bookings keep expiresAt but are no longer on hold. */
export function isActiveFareHold(booking: Booking) {
  if (!booking.expiresAt) return false;
  if (booking.next.ticketed || booking.next.paid || booking.next.cancelled || booking.next.refunded) return false;
  return isActiveFareHoldState(booking.status);
}

export function timelineTone(toStatus: string, currentStatus: string): TimelineMarker {
  return timelineMarker(toStatus, currentStatus);
}

export function confirmationComplete(booking: Booking) {
  return Boolean(
    booking.next.ticketed ||
      booking.status === "TICKETED" ||
      booking.next.cancelled ||
      booking.next.refunded ||
      booking.status === "REFUNDED",
  );
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function ageYears(dob: string) {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let years = today.getUTCFullYear() - birth.getUTCFullYear();
  const month = today.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < birth.getUTCDate())) years -= 1;
  return years;
}

export function validateTravelerForm(
  contact: { email: string; phone: string },
  passengers: PassengerForm[],
  passportRequired: boolean,
) {
  const errors: Record<string, string> = {};
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (contact.phone && (contact.phone.trim().length < 8 || contact.phone.trim().length > 20)) {
    errors.phone = "Enter a valid mobile number.";
  }
  passengers.forEach((row, index) => {
    if (row.firstName.trim().length < 2) errors[`${index}.firstName`] = "First name is required.";
    if (row.lastName.trim().length < 2) errors[`${index}.lastName`] = "Last name is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dateOfBirth)) {
      errors[`${index}.dateOfBirth`] = "Date of birth is required.";
    } else {
      const years = ageYears(row.dateOfBirth);
      if (years === null || new Date(`${row.dateOfBirth}T00:00:00Z`) > new Date()) {
        errors[`${index}.dateOfBirth`] = "Enter a valid date of birth.";
      } else if (row.type === "INFANT" && years >= 2) {
        errors[`${index}.dateOfBirth`] = "Infants must be under 2 years.";
      } else if (row.type === "CHILD" && (years < 2 || years >= 12)) {
        errors[`${index}.dateOfBirth`] = "Children must be 2–11 years.";
      } else if (row.type === "ADULT" && years < 12) {
        errors[`${index}.dateOfBirth`] = "Adults must be 12 or older.";
      }
    }
    if (row.nationality.trim().length < 2) errors[`${index}.nationality`] = "Nationality is required.";
    if (passportRequired && !row.passportNumber.trim()) {
      errors[`${index}.passportNumber`] = "Passport number is required for this itinerary.";
    }
    if (row.passportExpiry) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.passportExpiry)) {
        errors[`${index}.passportExpiry`] = "Enter a valid passport expiry date.";
      } else if (new Date(`${row.passportExpiry}T00:00:00Z`) < new Date()) {
        errors[`${index}.passportExpiry`] = "Passport expiry must be in the future.";
      }
    } else if (passportRequired) {
      errors[`${index}.passportExpiry`] = "Passport expiry date is required.";
    }
  });
  return errors;
}
