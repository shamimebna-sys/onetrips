export type AirportSearchRecord = {
  iataCode: string;
  name: string;
  isPopular?: boolean;
  city: {
    name: string;
    code?: string | null;
    country: { name: string; code: string };
  };
};

/** Case, Unicode compatibility, and whitespace only — safe for SQL token filters. */
export function normalizeAirportQuery(q: string): string {
  return q.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Compare user input and stored location fields with the same rules. */
export function normalizeAirportCompare(q: string): string {
  return normalizeAirportQuery(q)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeAirportQuery(q: string): string[] {
  const normalized = normalizeAirportQuery(q);
  return normalized ? normalized.split(" ") : [];
}

function compareTokens(q: string): string[] {
  const normalized = normalizeAirportCompare(q);
  return normalized ? normalized.split(" ") : [];
}

function searchableFields(airport: AirportSearchRecord): string[] {
  return [
    airport.iataCode,
    airport.name,
    airport.city.name,
    airport.city.code ?? "",
    airport.city.country.name,
    airport.city.country.code,
  ].map((value) => normalizeAirportCompare(value));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const next = new Array<number>(cols);
  for (let j = 0; j < cols; j += 1) prev[j] = j;
  for (let i = 1; i < rows; i += 1) {
    next[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min((prev[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j < cols; j += 1) prev[j] = next[j] ?? 0;
  }
  return prev[b.length] ?? 2;
}

function fieldMatchesToken(field: string, token: string): boolean {
  if (field.includes(token)) return true;
  if (token.length < 5) return false;
  return field.split(" ").some((word) => word.length >= 5 && editDistance(word, token) <= 1);
}

export function airportMatchesQuery(airport: AirportSearchRecord, q: string): boolean {
  const tokens = compareTokens(q);
  if (tokens.length === 0) return true;
  const fields = searchableFields(airport);
  return tokens.every((token) => fields.some((field) => fieldMatchesToken(field, token)));
}

export function airportMatchRank(airport: AirportSearchRecord, q: string): number {
  const query = normalizeAirportCompare(q);
  if (!query) return 99;

  const iata = normalizeAirportCompare(airport.iataCode);
  const name = normalizeAirportCompare(airport.name);
  const city = normalizeAirportCompare(airport.city.name);
  const cityCode = normalizeAirportCompare(airport.city.code ?? "");
  const country = normalizeAirportCompare(airport.city.country.name);
  const countryCode = normalizeAirportCompare(airport.city.country.code);

  if (iata === query || cityCode === query) return 0;
  if (iata.startsWith(query) || cityCode.startsWith(query)) return 1;
  if (name === query) return 2;
  if (city === query || city.startsWith(query)) return 3;
  if (country === query) return 4;
  if (country.startsWith(query) || countryCode === query || countryCode.startsWith(query)) return 5;
  return 6;
}

export function rankAirportSearchResults<T extends AirportSearchRecord>(airports: T[], q: string): T[] {
  if (!normalizeAirportQuery(q)) return airports;
  return [...airports].sort((a, b) => {
    const rankDiff = airportMatchRank(a, q) - airportMatchRank(b, q);
    if (rankDiff !== 0) return rankDiff;
    const popularDiff = Number(Boolean(b.isPopular)) - Number(Boolean(a.isPopular));
    if (popularDiff !== 0) return popularDiff;
    return a.iataCode.localeCompare(b.iataCode);
  });
}

export function filterAndRankAirports<T extends AirportSearchRecord>(
  airports: T[],
  q: string,
  limit?: number,
): T[] {
  const matched = airports.filter((airport) => airportMatchesQuery(airport, q));
  const ranked = rankAirportSearchResults(matched, q);
  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}

/**
 * The form value is the 3-letter IATA slice while the user types a city/country name.
 * Keep the longer in-progress query so search is not reduced to that slice.
 */
export function preserveInProgressAirportQuery(currentQuery: string, nextValue: string): string {
  if (currentQuery.length > nextValue.length && currentQuery.toUpperCase().startsWith(nextValue.toUpperCase())) {
    return currentQuery;
  }
  return nextValue;
}

export type DropdownAnchor = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
  transform?: string;
};

export function positionAnchoredDropdown(
  anchor: { top: number; left: number; width: number; height: number; bottom: number },
  viewport: { width: number; height: number },
  options?: { gap?: number; maxHeight?: number },
): DropdownAnchor {
  const gap = options?.gap ?? 4;
  const maxHeight = options?.maxHeight ?? 288;
  const spaceBelow = viewport.height - anchor.bottom - gap;
  const spaceAbove = anchor.top - gap;
  const placeAbove = spaceBelow <= 0 && spaceAbove > 48;
  const available = Math.max(80, placeAbove ? spaceAbove : spaceBelow);
  const height = Math.min(maxHeight, available);
  let left = anchor.left;
  let width = Math.max(0, anchor.width);
  if (left + width > viewport.width) {
    left = Math.max(0, viewport.width - width);
  }
  if (left < 0) {
    width = Math.min(width, viewport.width);
    left = 0;
  }
  if (placeAbove) {
    return { top: anchor.top - gap, left, width, maxHeight: height, placement: "above", transform: "translateY(-100%)" };
  }
  return { top: anchor.bottom + gap, left, width, maxHeight: height, placement: "below" };
}
