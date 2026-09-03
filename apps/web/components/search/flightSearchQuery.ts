/** Canonical flight-search query helpers, extracted from the homepage. */

export type FlightTripType = "one-way" | "round-trip" | "multi-city";

export type MultiCitySegment = {
  origin: string;
  destination: string;
  date: string;
};

export function emptyMultiCitySegments(): MultiCitySegment[] {
  return [
    { origin: "", destination: "", date: "" },
    { origin: "", destination: "", date: "" },
  ];
}

export function encodeMultiCitySegments(segments: MultiCitySegment[]): string {
  return segments
    .map(
      (seg) =>
        `${seg.origin.trim().slice(0, 3).toUpperCase()}~${seg.destination.trim().slice(0, 3).toUpperCase()}~${seg.date}`,
    )
    .join(",");
}

export function parseMultiCitySegments(raw: string | null | undefined): MultiCitySegment[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [origin = "", destination = "", date = ""] = part.split("~");
      return { origin, destination, date };
    });
  return parsed.length >= 2 ? parsed : emptyMultiCitySegments();
}

export function addMultiCitySegment(segments: MultiCitySegment[]): MultiCitySegment[] {
  return [...segments, { origin: "", destination: "", date: "" }];
}

export function removeMultiCitySegment(segments: MultiCitySegment[], index: number): MultiCitySegment[] {
  if (segments.length > 2) return segments.filter((_, i) => i !== index);
  return segments;
}

export function updateMultiCitySegment(
  segments: MultiCitySegment[],
  index: number,
  patch: Partial<MultiCitySegment>,
): MultiCitySegment[] {
  return segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment));
}

/** Same query string the homepage builds for /flights. */
export function buildFlightSearchParams(input: {
  tripType: FlightTripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: string;
  cabin: string;
  segments: MultiCitySegment[];
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("type", input.tripType);
  if (input.tripType === "multi-city") {
    params.set("segments", encodeMultiCitySegments(input.segments));
  } else {
    params.set("from", input.origin.trim().slice(0, 3).toUpperCase());
    params.set("to", input.destination.trim().slice(0, 3).toUpperCase());
    params.set("date", input.departureDate);
    params.set("adults", input.adults);
    params.set("cabin", input.cabin);
    if (input.tripType === "round-trip") params.set("return", input.returnDate);
  }
  return params;
}

export function multiCitySearchBody(segments: MultiCitySegment[], adults: string, cabin: string) {
  return {
    tripType: "multi-city" as const,
    segments: segments.map((seg) => ({
      origin: seg.origin.trim().slice(0, 3).toUpperCase(),
      destination: seg.destination.trim().slice(0, 3).toUpperCase(),
      date: seg.date,
    })),
    adults: Number(adults),
    children: 0,
    infants: 0,
    cabin,
  };
}
