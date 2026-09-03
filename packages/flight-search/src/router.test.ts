import { afterEach, describe, expect, it } from "vitest";
import { createFlightProvider, getFlightProvider, resetFlightProviderForTests } from "./router";
import { getFlightProviderConfig } from "./config";

describe("provider router", () => {
  afterEach(() => {
    resetFlightProviderForTests();
    delete process.env.FLIGHT_PROVIDER;
  });

  it("returns the mock adapter for FLIGHT_PROVIDER=mock", () => {
    process.env.FLIGHT_PROVIDER = "mock";
    const provider = createFlightProvider(getFlightProviderConfig());
    expect(provider.id).toBe("mock-gds");
    expect(provider.capabilities.createBooking).toBe(true);
    expect(getFlightProvider().id).toBe("mock-gds");
  });

  it("rejects sandbox until a real adapter exists", () => {
    process.env.FLIGHT_PROVIDER = "sandbox";
    expect(() => getFlightProviderConfig()).toThrow(/real GDS adapter/i);
  });
});
