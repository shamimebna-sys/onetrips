import { MockFlightProvider } from "./adapters/mock";
import type { FlightProviderPort } from "./types";
import { getFlightProvider } from "./router";

/** @deprecated Use getFlightProvider() from the router. Kept for tests that inject catalog maps. */
export function createCatalogMock(
  airports: Map<string, { iataCode: string; city: string; country: string }>,
  airlines: Map<string, { iataCode: string; name: string }>,
): FlightProviderPort {
  return new MockFlightProvider(airports, airlines);
}

export { getFlightProvider };
