import { describe, expect, it } from "vitest";
import { canTransition, isActiveFareHoldState, timelineMarker } from "./booking-states";

describe("booking state machine", () => {
  it("allows unknown supplier outcomes without a second create", () => {
    expect(canTransition("BOOKING_PENDING", "BOOKING_UNKNOWN")).toBe(true);
    expect(canTransition("BOOKING_UNKNOWN", "BOOKED")).toBe(true);
    expect(canTransition("BOOKING_UNKNOWN", "BOOKING_FAILED")).toBe(true);
    expect(canTransition("BOOKING_UNKNOWN", "BOOKING_PENDING")).toBe(false);
    expect(canTransition("TICKETING_PENDING", "TICKETING_UNKNOWN")).toBe(true);
    expect(canTransition("TICKETING_UNKNOWN", "TICKETED")).toBe(true);
    expect(canTransition("TICKETING_UNKNOWN", "TICKETING_FAILED")).toBe(true);
  });

  it("rejects illegal jumps that would skip payment or reverse money movement", () => {
    const illegal: Array<[Parameters<typeof canTransition>[0], Parameters<typeof canTransition>[1]]> = [
      ["PAYMENT_PENDING", "TICKETED"],
      ["SELECTED", "TICKETED"],
      ["CANCELLED", "BOOKED"],
      ["REFUNDED", "PAYMENT_SUCCESS"],
      ["TICKETED", "PAYMENT_PENDING"],
      ["EXPIRED", "BOOKED"],
      ["REFUNDED", "TICKETED"],
    ];
    for (const [from, to] of illegal) {
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it("does not treat ticketed or paid bookings as an active fare hold", () => {
    expect(isActiveFareHoldState("TICKETED")).toBe(false);
    expect(isActiveFareHoldState("PAYMENT_SUCCESS")).toBe(false);
    expect(isActiveFareHoldState("PAYMENT_PENDING")).toBe(true);
    expect(isActiveFareHoldState("PASSENGER_PENDING")).toBe(true);
  });

  it("marks timeline events from persisted status, not merely because history exists", () => {
    expect(timelineMarker("PAYMENT_SUCCESS", "TICKETED")).toBe("completed");
    expect(timelineMarker("TICKETED", "TICKETED")).toBe("completed");
    expect(timelineMarker("TICKETING_PENDING", "TICKETING_PENDING")).toBe("current");
    expect(timelineMarker("PAYMENT_FAILED", "PAYMENT_FAILED")).toBe("failed");
    expect(timelineMarker("CANCELLED", "CANCELLED")).toBe("failed");
  });
});
