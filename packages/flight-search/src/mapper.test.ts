import { describe, expect, it } from "vitest";
import { toNormalizedOffer } from "./mapper";
import type { FlightOffer } from "./types";

const offer: FlightOffer = {
  id: "mock-gds:ow:DACDXB:0",
  provider: "mock-gds",
  cabin: "ECONOMY",
  cabinLabel: "Economy",
  itineraries: [],
  fare: { currency: "BDT", base: 100, taxes: 20, total: 120, totalLabel: "BDT 120" },
  baggage: { cabin: "7kg", checked: "20kg" },
  refundable: false,
  seatsLeft: 4,
  brandedFare: "Lite",
};

describe("provider mapper", () => {
  it("keeps mock offers in the normalized shape", () => {
    expect(toNormalizedOffer(offer)).toEqual(offer);
    expect(toNormalizedOffer(offer).provider).toBe("mock-gds");
  });
});
