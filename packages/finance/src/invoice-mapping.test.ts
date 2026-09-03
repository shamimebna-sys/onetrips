import { describe, expect, it } from "vitest";
import { canonicalInvoiceTotals, routeFromSegments } from "./invoice-mapping";

describe("routeFromSegments", () => {
  it("builds the full multi-stop itinerary instead of first-origin + last-destination", () => {
    const route = routeFromSegments([
      { origin: "DAC", destination: "IST" },
      { origin: "IST", destination: "DXB" },
      { origin: "DXB", destination: "BKK" },
      { origin: "BKK", destination: "DAC" },
    ]);
    expect(route).toBe("DAC → IST → DXB → BKK → DAC");
    expect(route).not.toBe("DAC → DAC");
  });

  it("does not hardcode DAC when the itinerary is elsewhere", () => {
    expect(
      routeFromSegments([
        { origin: "DXB", destination: "LHR" },
        { origin: "LHR", destination: "JFK" },
      ]),
    ).toBe("DXB → LHR → JFK");
  });

  it("returns null for an empty itinerary", () => {
    expect(routeFromSegments([])).toBeNull();
  });
});

describe("canonicalInvoiceTotals", () => {
  it("uses the persisted booking total instead of recomputing line items", () => {
    expect(canonicalInvoiceTotals("79719.40")).toEqual({
      amount: 79719.4,
      tax: 0,
      total: 79719.4,
    });
    expect(canonicalInvoiceTotals(79719.4).total).toBe(canonicalInvoiceTotals("79719.40").total);
  });
});
