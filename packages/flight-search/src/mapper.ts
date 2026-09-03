import type { FlightOffer } from "./types";

/** Mock offers are already normalized. A real GDS adapter maps vendor payloads here. */
export function toNormalizedOffer(offer: FlightOffer): FlightOffer {
  return offer;
}
