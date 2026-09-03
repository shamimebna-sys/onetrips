import { fromCents, toCents } from "@onetrips/shared";

export type InvoiceRouteSegment = {
  origin: string;
  destination: string;
};

/** Consecutive airport codes from persisted segments. Never first-origin + last-destination only. */
export function routeFromSegments(segments: InvoiceRouteSegment[]): string | null {
  if (segments.length === 0) return null;
  const codes: string[] = [];
  for (const segment of segments) {
    const origin = segment.origin?.trim();
    const destination = segment.destination?.trim();
    if (origin && codes[codes.length - 1] !== origin) codes.push(origin);
    if (destination) codes.push(destination);
  }
  return codes.length > 0 ? codes.join(" → ") : null;
}

/** Invoice amount/tax/total must follow the persisted booking total, not a recomputed line-item sum. */
export function canonicalInvoiceTotals(bookingTotal: number | string) {
  const total = fromCents(toCents(bookingTotal));
  return { amount: total, tax: 0, total };
}
