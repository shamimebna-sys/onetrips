export const BOOKING_STATES = [
  "SEARCHED",
  "SELECTED",
  "REVALIDATING",
  "PRICE_CONFIRMED",
  "PRICE_CHANGED",
  "UNAVAILABLE",
  "PASSENGER_PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "BOOKING_PENDING",
  "BOOKED",
  "BOOKING_FAILED",
  "BOOKING_UNKNOWN",
  "TICKETING_PENDING",
  "TICKETED",
  "TICKETING_FAILED",
  "TICKETING_UNKNOWN",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "EXPIRED",
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

const TRANSITIONS: Record<BookingState, BookingState[]> = {
  SEARCHED: ["SELECTED", "EXPIRED"],
  SELECTED: ["REVALIDATING", "EXPIRED", "CANCELLED"],
  REVALIDATING: ["PRICE_CONFIRMED", "PRICE_CHANGED", "UNAVAILABLE"],
  PRICE_CHANGED: ["SELECTED", "EXPIRED", "CANCELLED"],
  UNAVAILABLE: ["SELECTED", "EXPIRED", "CANCELLED"],
  PRICE_CONFIRMED: ["PASSENGER_PENDING", "EXPIRED", "CANCELLED"],
  PASSENGER_PENDING: ["PAYMENT_PENDING", "EXPIRED", "CANCELLED"],
  PAYMENT_PENDING: ["PAYMENT_PROCESSING", "EXPIRED", "CANCELLED"],
  PAYMENT_PROCESSING: ["PAYMENT_SUCCESS", "PAYMENT_FAILED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "EXPIRED", "CANCELLED"],
  PAYMENT_SUCCESS: ["BOOKING_PENDING"],
  BOOKING_PENDING: ["BOOKED", "BOOKING_FAILED", "BOOKING_UNKNOWN"],
  BOOKING_FAILED: ["REFUND_PENDING"],
  BOOKING_UNKNOWN: ["BOOKED", "BOOKING_FAILED"],
  BOOKED: ["TICKETING_PENDING", "CANCELLED", "EXPIRED"],
  TICKETING_PENDING: ["TICKETED", "TICKETING_FAILED", "TICKETING_UNKNOWN", "CANCELLED"],
  TICKETING_FAILED: ["TICKETING_PENDING", "CANCELLED"],
  TICKETING_UNKNOWN: ["TICKETED", "TICKETING_FAILED", "TICKETING_PENDING"],
  TICKETED: ["CANCELLED"],
  CANCELLED: ["REFUND_PENDING"],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
  EXPIRED: [],
};

export function canTransition(from: BookingState, to: BookingState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BookingState, to: BookingState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal booking transition: ${from} → ${to}`);
  }
}

export function allowedTransitions(from: BookingState): BookingState[] {
  return TRANSITIONS[from] ?? [];
}

const IN_PROGRESS: ReadonlySet<string> = new Set([
  "REVALIDATING",
  "PRICE_CONFIRMED",
  "PRICE_CHANGED",
  "PASSENGER_PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "BOOKING_PENDING",
  "BOOKED",
  "TICKETING_PENDING",
  "BOOKING_UNKNOWN",
  "TICKETING_UNKNOWN",
  "REFUND_PENDING",
]);

const FAILED: ReadonlySet<string> = new Set([
  "UNAVAILABLE",
  "PAYMENT_FAILED",
  "BOOKING_FAILED",
  "TICKETING_FAILED",
  "CANCELLED",
  "EXPIRED",
]);

const PAID: ReadonlySet<string> = new Set([
  "PAYMENT_SUCCESS",
  "BOOKING_PENDING",
  "BOOKED",
  "TICKETING_PENDING",
  "TICKETED",
  "TICKETING_FAILED",
  "TICKETING_UNKNOWN",
  "BOOKING_UNKNOWN",
  "BOOKING_FAILED",
  "REFUND_PENDING",
  "REFUNDED",
]);

export function isInProgressBookingState(status: string): boolean {
  return IN_PROGRESS.has(status);
}

export function isFailedBookingState(status: string): boolean {
  return FAILED.has(status);
}

export function isPaidBookingState(status: string): boolean {
  return PAID.has(status);
}

/** Fare-hold chrome is only valid while the booking is unpaid and not terminal. */
export function isActiveFareHoldState(status: string): boolean {
  if (isPaidBookingState(status)) return false;
  if (status === "TICKETED" || status === "CANCELLED" || status === "EXPIRED" || status === "UNAVAILABLE") {
    return false;
  }
  return true;
}

export type TimelineMarker = "completed" | "current" | "failed";

export function timelineMarker(toStatus: string, currentStatus: string): TimelineMarker {
  if (isFailedBookingState(toStatus)) return "failed";
  if (toStatus === currentStatus && isInProgressBookingState(currentStatus)) return "current";
  if (toStatus === currentStatus && isFailedBookingState(currentStatus)) return "failed";
  return "completed";
}
