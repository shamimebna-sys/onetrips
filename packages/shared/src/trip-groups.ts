import type { BookingState } from "./booking-states";

export const TRIP_GROUPS = ["upcoming", "completed", "cancelled", "refunds"] as const;
export type TripGroup = (typeof TRIP_GROUPS)[number];

const CANCELLED: ReadonlySet<string> = new Set(["CANCELLED", "EXPIRED", "UNAVAILABLE"]);
const REFUNDS: ReadonlySet<string> = new Set(["REFUND_PENDING", "REFUNDED"]);
const TERMINAL_FAILURE: ReadonlySet<string> = new Set(["BOOKING_FAILED", "PAYMENT_FAILED"]);

const CUSTOMER_LABELS: Record<string, string> = {
  SEARCHED: "Selected",
  SELECTED: "Selected",
  REVALIDATING: "Checking fare",
  PRICE_CONFIRMED: "Price confirmed",
  PRICE_CHANGED: "Price changed",
  PASSENGER_PENDING: "Traveler details",
  PAYMENT_PENDING: "Awaiting payment",
  PAYMENT_PROCESSING: "Payment in progress",
  PAYMENT_FAILED: "Payment failed",
  PAYMENT_SUCCESS: "Paid",
  BOOKING_PENDING: "Confirming reservation",
  BOOKED: "Booked",
  BOOKING_FAILED: "Reservation failed",
  BOOKING_UNKNOWN: "Confirming reservation",
  TICKETING_PENDING: "Issuing documents",
  TICKETED: "Ticketed",
  TICKETING_FAILED: "Ticketing issue",
  TICKETING_UNKNOWN: "Confirming tickets",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund in progress",
  REFUNDED: "Refunded",
  EXPIRED: "Expired",
  UNAVAILABLE: "Unavailable",
};

export function customerStatusLabel(status: string): string {
  return CUSTOMER_LABELS[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function startOfUtcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/** Date-aware grouping that never invents states outside the booking machine. */
export function tripGroupFor(input: {
  status: string;
  travelAt?: string | Date | null;
  now?: Date;
}): TripGroup {
  const status = input.status as BookingState;
  if (REFUNDS.has(status)) return "refunds";
  if (CANCELLED.has(status) || TERMINAL_FAILURE.has(status)) return "cancelled";

  const travelAt = input.travelAt ? new Date(input.travelAt) : null;
  const now = input.now ?? new Date();
  if (status === "TICKETED" && travelAt && !Number.isNaN(travelAt.getTime())) {
    return startOfUtcDay(travelAt) < startOfUtcDay(now) ? "completed" : "upcoming";
  }
  return "upcoming";
}
