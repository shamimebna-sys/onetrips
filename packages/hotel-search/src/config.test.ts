import { afterEach, describe, expect, it } from "vitest";
import { getHotelProviderConfig } from "./config";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("hotel provider config", () => {
  it("defaults to mock", () => {
    delete process.env.HOTEL_PROVIDER;
    expect(getHotelProviderConfig().mode).toBe("mock");
  });

  it("rejects a real hotel supplier mode without an adapter", () => {
    process.env.HOTEL_PROVIDER = "production";
    expect(() => getHotelProviderConfig()).toThrow(/real hotel supplier/i);
  });

  it("rejects an unknown provider", () => {
    process.env.HOTEL_PROVIDER = "hotelbeds";
    expect(() => getHotelProviderConfig()).toThrow(/Unsupported HOTEL_PROVIDER/);
  });
});
