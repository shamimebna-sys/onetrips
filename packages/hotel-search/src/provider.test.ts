import { describe, expect, it } from "vitest";
import { ProviderNoAvailabilityError } from "@onetrips/shared";
import { MockHotelProvider } from "./adapters/mock";
import type { HotelSearchRequest } from "./types";

const request: HotelSearchRequest = {
  destination: "DAC",
  cityCode: "DAC",
  cityName: "Dhaka",
  countryCode: "BD",
  checkIn: "2099-12-01",
  checkOut: "2099-12-04",
  rooms: 1,
  adults: 2,
  children: 0,
  infants: 0,
};

describe("mock hotel scenarios", () => {
  it("returns priced room offers for a catalog city", async () => {
    const provider = new MockHotelProvider("SUCCESS");
    const result = await provider.search(request);
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers[0].provider).toBe("mock-hotel");
    expect(result.offers[0].cityCode).toBe("DAC");
    expect(result.offers[0].nights).toBe(3);
    expect(result.offers[0].fare.total).toBeGreaterThan(0);
    expect(result.offers[0].itineraries[0].segments[0].airlineCode).toBe("HT");
  });

  it("raises a safe unavailable error on revalidate", async () => {
    const provider = new MockHotelProvider("UNAVAILABLE");
    const success = new MockHotelProvider("SUCCESS");
    const { offers } = await success.search(request);
    await expect(provider.revalidate(offers[0])).rejects.toBeInstanceOf(ProviderNoAvailabilityError);
  });

  it("changes the rate on revalidate", async () => {
    const provider = new MockHotelProvider("PRICE_CHANGED");
    const { offers } = await provider.search(request);
    const next = await provider.revalidate(offers[0]);
    expect(next.fare.total).toBeGreaterThan(offers[0].fare.total);
  });
});
