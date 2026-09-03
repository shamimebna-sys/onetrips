import { afterEach, describe, expect, it } from "vitest";
import { getFlightProviderConfig } from "./config";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("flight provider config", () => {
  it("defaults to mock", () => {
    delete process.env.FLIGHT_PROVIDER;
    expect(getFlightProviderConfig().mode).toBe("mock");
  });

  it("rejects a real GDS mode without an adapter", () => {
    process.env.FLIGHT_PROVIDER = "production";
    expect(() => getFlightProviderConfig()).toThrow(/real GDS adapter/i);
  });

  it("rejects an unknown provider", () => {
    process.env.FLIGHT_PROVIDER = "amadeus";
    expect(() => getFlightProviderConfig()).toThrow(/Unsupported FLIGHT_PROVIDER/);
  });
});
