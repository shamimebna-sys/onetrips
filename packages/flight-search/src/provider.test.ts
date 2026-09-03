import { beforeEach, describe, expect, it } from "vitest";
import {
  ProviderBookingError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  ProviderUnknownError,
} from "@onetrips/shared";
import { MockFlightProvider, resetMockProviderState } from "./adapters/mock";
import { InstrumentedFlightProvider } from "./gateway";
import { resetOperationsForTests } from "./operations";
import { resetCircuitForTests } from "./circuit";
import { resetHealthForTests } from "./health";
import type { FlightProviderConfig } from "./config";
import type { SearchRequest } from "./types";

const airports = new Map([
  ["DAC", { iataCode: "DAC", city: "Dhaka", country: "BD" }],
  ["DXB", { iataCode: "DXB", city: "Dubai", country: "AE" }],
]);
const airlines = new Map([["BG", { iataCode: "BG", name: "Biman" }]]);

const request: SearchRequest = {
  tripType: "one-way",
  segments: [{ origin: "DAC", destination: "DXB", date: "2099-12-01" }],
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "ECONOMY",
};

function config(partial: Partial<FlightProviderConfig> = {}): FlightProviderConfig {
  return {
    mode: "mock",
    searchTimeoutMs: 200,
    revalidationTimeoutMs: 200,
    bookingTimeoutMs: 40,
    ticketingTimeoutMs: 40,
    cancellationTimeoutMs: 40,
    mockScenario: "SUCCESS",
    circuitFailureThreshold: 8,
    circuitOpenMs: 1000,
    retryLimit: 1,
    ...partial,
  };
}

function wrap(inner: MockFlightProvider, cfg?: Partial<FlightProviderConfig>) {
  return new InstrumentedFlightProvider(inner, config(cfg));
}

beforeEach(() => {
  resetMockProviderState();
  resetOperationsForTests();
  resetCircuitForTests();
  resetHealthForTests();
});

describe("mock GDS scenarios", () => {
  it("returns normalized offers", async () => {
    const provider = new MockFlightProvider(airports, airlines, "SUCCESS");
    const result = await provider.search(request);
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers[0].provider).toBe("mock-gds");
    expect(result.offers[0].fare.total).toBeGreaterThan(0);
  });

  it("attaches refund penalties for refundable fares", async () => {
    const provider = new MockFlightProvider(airports, airlines, "SUCCESS");
    const { offers } = await provider.search({ ...request, cabin: "BUSINESS" });
    const offer = offers[0];
    expect(offer.refundable).toBe(true);
    expect(offer.penalties?.some((row) => row.type === "REFUND" && row.amount === 2500)).toBe(true);
    const rules = await provider.getFareRules(offer.id);
    expect(rules.penalties.some((row) => row.type === "REFUND" && row.amount === 2500)).toBe(true);
  });

  it("raises a safe unavailable error", async () => {
    const provider = wrap(new MockFlightProvider(airports, airlines, "UNAVAILABLE"));
    await expect(provider.search(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("changes the fare on revalidate", async () => {
    const provider = new MockFlightProvider(airports, airlines, "PRICE_CHANGED");
    const { offers } = await provider.search(request);
    const next = await provider.revalidate(offers[0]);
    expect(next.fare.total).toBeGreaterThan(offers[0].fare.total);
  });

  it("does not create a second PNR after a booking timeout", async () => {
    const inner = new MockFlightProvider(airports, airlines, "BOOKING_TIMEOUT");
    const provider = wrap(inner);
    const payload = {
      bookingId: "bk_timeout_1",
      bookingRef: "OTTEST001",
      correlationId: "corr-1",
      idempotencyKey: "book:bk_timeout_1",
    };
    const first = await provider.createBooking(payload);
    expect(first.providerRef).toMatch(/^MCK/);
    const again = await provider.createBooking(payload);
    expect(again.providerRef).toBe(first.providerRef);
  });

  it("does not issue a second ticket after a ticketing timeout", async () => {
    const inner = new MockFlightProvider(airports, airlines, "SUCCESS");
    const booked = await inner.createBooking({
      bookingId: "bk_ticket_1",
      bookingRef: "OTTEST002",
      correlationId: "c",
      idempotencyKey: "book:bk_ticket_1",
    });
    const timed = new MockFlightProvider(airports, airlines, "TICKETING_TIMEOUT");
    const provider = wrap(timed);
    const request = {
      providerRef: booked.providerRef,
      bookingId: "bk_ticket_1",
      passengerCount: 1,
      correlationId: "c",
      idempotencyKey: "ticket:bk_ticket_1",
    };
    const first = await provider.issueTicket(request);
    expect(first.ticketNumbers).toHaveLength(1);
    const again = await provider.issueTicket(request);
    expect(again.ticketNumbers).toEqual(first.ticketNumbers);
  });

  it("does not send a second cancel after a cancel timeout", async () => {
    const inner = new MockFlightProvider(airports, airlines, "SUCCESS");
    const booked = await inner.createBooking({
      bookingId: "bk_cancel_1",
      bookingRef: "OTTEST003",
      correlationId: "c",
      idempotencyKey: "book:bk_cancel_1",
    });
    const timed = new MockFlightProvider(airports, airlines, "CANCEL_TIMEOUT");
    const provider = wrap(timed);
    const request = {
      providerRef: booked.providerRef,
      bookingId: "bk_cancel_1",
      correlationId: "c",
      idempotencyKey: "cancel:bk_cancel_1",
    };
    const first = await provider.cancelBooking(request);
    expect(first.cancelled).toBe(true);
    const again = await provider.cancelBooking(request);
    expect(again.cancelled).toBe(true);
  });

  it("raises a safe rate-limit error", async () => {
    const provider = wrap(new MockFlightProvider(airports, airlines, "RATE_LIMIT"));
    await expect(provider.search(request)).rejects.toBeInstanceOf(ProviderRateLimitError);
  });

  it("maps a malformed response to a provider-unknown error", async () => {
    const provider = wrap(new MockFlightProvider(airports, airlines, "MALFORMED_RESPONSE"));
    await expect(provider.search(request)).rejects.toBeInstanceOf(ProviderUnknownError);
  });

  it("times out search without leaking internals", async () => {
    const provider = wrap(new MockFlightProvider(airports, airlines, "TIMEOUT"), { searchTimeoutMs: 30, retryLimit: 0 });
    await expect(provider.search(request)).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it("does not create a PNR when createBooking times out before commit", async () => {
    const inner = new MockFlightProvider(airports, airlines, "TIMEOUT");
    const provider = wrap(inner, { bookingTimeoutMs: 30, retryLimit: 0 });
    await expect(
      provider.createBooking({
        bookingId: "bk_hang_before",
        bookingRef: "OTTEST004",
        correlationId: "c",
        idempotencyKey: "book:bk_hang_before",
      }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
    const status = await inner.getBookingStatus({ bookingId: "bk_hang_before", correlationId: "c" });
    expect(status.status).toBe("NOT_FOUND");
  });

  it("rejects a failed booking without a PNR", async () => {
    const inner = new MockFlightProvider(airports, airlines, "BOOKING_FAILURE");
    const provider = wrap(inner);
    await expect(
      provider.createBooking({
        bookingId: "bk_fail_1",
        bookingRef: "OTTEST005",
        correlationId: "c",
        idempotencyKey: "book:bk_fail_1",
      }),
    ).rejects.toBeInstanceOf(ProviderBookingError);
    const status = await inner.getBookingStatus({ bookingId: "bk_fail_1", correlationId: "c" });
    expect(status.status).toBe("NOT_FOUND");
  });

  it("runs search → revalidate → book → ticket → cancel", async () => {
    const provider = wrap(new MockFlightProvider(airports, airlines, "SUCCESS"), {
      bookingTimeoutMs: 200,
      ticketingTimeoutMs: 200,
      cancellationTimeoutMs: 200,
    });
    const { offers } = await provider.search(request);
    expect(offers[0].fare.total).toBeGreaterThan(0);
    const confirmed = await provider.revalidate(offers[0]);
    expect(confirmed.revalidated).toBe(true);
    const booked = await provider.createBooking({
      bookingId: "bk_happy",
      bookingRef: "OTTEST006",
      offerId: confirmed.id,
      correlationId: "happy",
      idempotencyKey: "book:bk_happy",
    });
    expect(booked.providerRef).toMatch(/^MCK/);
    const tickets = await provider.issueTicket({
      providerRef: booked.providerRef,
      bookingId: "bk_happy",
      passengerCount: 1,
      correlationId: "happy",
      idempotencyKey: "ticket:bk_happy",
    });
    expect(tickets.ticketNumbers).toHaveLength(1);
    const cancelled = await provider.cancelBooking({
      providerRef: booked.providerRef,
      bookingId: "bk_happy",
      correlationId: "happy",
      idempotencyKey: "cancel:bk_happy",
    });
    expect(cancelled.cancelled).toBe(true);
    const status = await provider.getBookingStatus({
      bookingId: "bk_happy",
      providerRef: booked.providerRef,
      correlationId: "happy",
    });
    expect(status.status).toBe("CANCELLED");
    expect(status.ticketNumbers).toEqual(tickets.ticketNumbers);
  });
});
