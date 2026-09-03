"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Badge } from "@onetrips/ui";
import { formatFareMoney, refundPresentation } from "@/lib/flightRefund";

type Fare = {
  currency: string;
  base: number;
  taxes: number;
  total: number;
  totalLabel: string;
  markup?: number;
  serviceFee?: number;
  discount?: number;
};

type FarePenalty = {
  type: "CHANGE" | "REFUND" | "NOSHOW";
  amount: number;
  currency?: string;
  notes?: string;
};

type Offer = {
  id: string;
  cabinLabel: string;
  brandedFare: string;
  refundable: boolean;
  baggage: { cabin: string; checked: string };
  fare: Fare;
  fareRules?: { refundable?: boolean; penalties?: FarePenalty[] };
  penalties?: FarePenalty[];
  itineraries: Array<{
    durationLabel: string;
    stopsLabel: string;
    arrivalDayOffset: number;
    segments: Array<{
      origin: string;
      originCity: string;
      destination: string;
      destinationCity: string;
      departureTime: string;
      arrivalTime: string;
      durationLabel?: string;
      airlineCode?: string;
      airlineName: string;
      flightNumber: string;
      aircraft: string;
    }>;
  }>;
};

type Segment = Offer["itineraries"][number]["segments"][number];
type Itinerary = Offer["itineraries"][number];

const CARD = "rounded-[20px] border border-line bg-white p-5 shadow-[0_8px_28px_rgba(16,23,42,0.04)] md:p-6 lg:p-8";
const LABEL = "text-[10px] font-bold uppercase tracking-[0.18em] text-copy-muted";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2";

function fareBreakdownRows(fare: Fare) {
  const fees = (fare.markup ?? 0) + (fare.serviceFee ?? 0);
  const discount = fare.discount ?? 0;
  const rows: Array<{ label: string; amount: number }> = [
    { label: "Base fare", amount: fare.base },
    { label: "Taxes", amount: fare.taxes },
  ];
  if (fees !== 0) rows.push({ label: "Fees / surcharges", amount: fees });
  if (discount !== 0) rows.push({ label: "Discount", amount: -discount });
  return rows;
}

function ReviewInner() {
  const params = useSearchParams();
  const sid = params.get("sid");
  const offerId = params.get("offer");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [families, setFamilies] = useState<Offer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sid || !offerId) return;
    fetch(`/api/flights/sessions/${sid}/offers/${encodeURIComponent(offerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.offer) setOffer(data.offer);
        else setError(data.message || "Fare not found");
      });
    fetch(`/api/flights/sessions/${sid}`)
      .then((res) => res.json())
      .then((data) => setFamilies(Array.isArray(data.offers) ? data.offers : []));
  }, [sid, offerId]);

  const familyRows = useMemo(() => {
    if (!offer) return [];
    const key = (item: Offer) =>
      item.itineraries
        .map((itinerary) => itinerary.segments.map((leg) => leg.flightNumber).join("-"))
        .join("|");
    const selected = key(offer);
    return families.filter((row) => key(row) === selected).slice(0, 6);
  }, [families, offer]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-canvas">
      <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-10">
        <Link
          href={`/flights?sid=${sid ?? ""}`}
          aria-label="Back to results"
          className={`mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-copy-muted transition-colors hover:text-navy ${FOCUS} rounded-md`}
        >
          <BackIcon />
          Back to results
        </Link>
        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-[10px] font-black uppercase text-red-600">{error}</div>
        )}
        {!offer && !error && (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d4af37]/20 border-t-[#d4af37]" />
          </div>
        )}
        {offer && (
          <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_18.5rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-7 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <SelectedFareHeader offer={offer} />
            <aside className="min-w-0 md:sticky md:top-20 md:col-start-2 md:row-span-2 md:self-start">
              <PriceSummaryCard
                offer={offer}
                continueHref={`/booking/start?sid=${sid}&offer=${encodeURIComponent(offerId ?? "")}`}
              />
            </aside>
            <div className="flex min-w-0 flex-col gap-5">
              {offer.itineraries.map((itinerary, index) => (
                <ItineraryCard key={index} itinerary={itinerary} index={index} />
              ))}
              {familyRows.length > 1 ? <FareFamilyMatrix sid={sid} offerId={offerId} rows={familyRows} /> : null}
              <ImportantFareInformation offer={offer} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SelectedFareHeader({ offer }: { offer: Offer }) {
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={LABEL}>Selected fare</p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          <CheckIcon />
          Fare selected
        </p>
      </div>
      <p className="mt-3 text-[2rem] font-bold leading-none tabular-nums tracking-tight text-navy md:text-[2.25rem]">
        {offer.fare.totalLabel}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge>{offer.cabinLabel}</Badge>
        <Badge tone="gold">{offer.brandedFare}</Badge>
        <Badge tone={offer.refundable ? "success" : "neutral"}>
          {offer.refundable ? "Refundable" : "Non-refundable"}
        </Badge>
      </div>
    </section>
  );
}

function ItineraryCard({ itinerary, index }: { itinerary: Itinerary; index: number }) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  if (!first || !last) return null;

  return (
    <section className={CARD}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-dark">
            {index === 0 ? "Outbound" : "Return / next"}
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-navy">
            {first.origin} <span className="font-semibold text-copy-muted">→</span> {last.destination}
          </h2>
        </div>
        <p className="text-sm font-semibold text-copy-muted">
          {itinerary.durationLabel} · {itinerary.stopsLabel}
        </p>
      </header>
      <div className="flex flex-col">
        {itinerary.segments.map((leg, legIndex) => (
          <div key={`${leg.flightNumber}-${legIndex}`}>
            {legIndex > 0 ? (
              <ConnectionMarker previous={itinerary.segments[legIndex - 1]} stopsLabel={itinerary.stopsLabel} />
            ) : null}
            <FlightTimeline
              leg={leg}
              arrivalOffset={legIndex === itinerary.segments.length - 1 ? itinerary.arrivalDayOffset : 0}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function FlightTimeline({ leg, arrivalOffset }: { leg: Segment; arrivalOffset: number }) {
  const airlineMeta = [leg.flightNumber, leg.aircraft].filter(Boolean).join(" · ");
  return (
    <div className="grid grid-cols-[4.25rem_1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4.75rem_1.25rem_minmax(0,1fr)]">
      <TimePlace time={leg.departureTime} />
      <TimelineRail />
      <AirportBlock code={leg.origin} city={leg.originCity} />

      <div className="flex items-center justify-end">
        {leg.durationLabel ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gold-dark">{leg.durationLabel}</p>
        ) : null}
      </div>
      <div className="relative">
        <span className="absolute inset-x-[5px] inset-y-0 bg-line" aria-hidden />
      </div>
      <AirlineBlock name={leg.airlineName} code={leg.airlineCode} meta={airlineMeta} />

      <TimePlace time={leg.arrivalTime} offset={arrivalOffset} />
      <TimelineRail end />
      <AirportBlock code={leg.destination} city={leg.destinationCity} />
    </div>
  );
}

function TimePlace({ time, offset }: { time: string; offset?: number }) {
  return (
    <div className="pt-0.5 text-right">
      <p className="text-base font-bold tabular-nums leading-6 text-navy">
        {time}
        {offset && offset > 0 ? <span className="text-xs font-bold text-gold-dark"> +{offset}</span> : null}
      </p>
    </div>
  );
}

function TimelineRail({ end = false }: { end?: boolean }) {
  return (
    <div className="relative flex justify-center">
      {end ? null : <span className="absolute inset-x-[5px] top-2.5 bottom-0 bg-line" aria-hidden />}
      <span className="relative z-10 mt-1.5 size-2.5 rounded-full border-2 border-navy bg-white" aria-hidden />
    </div>
  );
}

function AirportBlock({ code, city }: { code: string; city: string }) {
  return (
    <div className="min-w-0 pb-1">
      <p className="text-lg font-bold leading-6 tracking-tight text-navy">{code}</p>
      <p className="truncate text-sm text-copy-muted" title={city}>
        {city}
      </p>
    </div>
  );
}

function AirlineBlock({ name, code, meta }: { name: string; code?: string; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-5">
      {code ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-[11px] font-bold text-white">
          {code}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-navy" title={name}>
          {name}
        </p>
        {meta ? (
          <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-copy-muted" title={meta}>
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ConnectionMarker({ previous, stopsLabel }: { previous?: Segment; stopsLabel: string }) {
  if (!previous) return null;
  return (
    <div className="my-3 flex items-center gap-3 pl-[4.25rem] sm:pl-[4.75rem]">
      <span className="h-px min-w-3 flex-1 bg-line" aria-hidden />
      <p
        className="max-w-[min(100%,18rem)] truncate rounded-full border border-[#d4af37]/30 bg-gold-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-dark"
        title={`${stopsLabel} — ${previous.destinationCity} · ${previous.destination}`}
      >
        {stopsLabel} — {previous.destinationCity} · {previous.destination}
      </p>
      <span className="h-px min-w-3 flex-1 bg-line" aria-hidden />
    </div>
  );
}

function FareFamilyMatrix({
  sid,
  offerId,
  rows,
}: {
  sid: string | null;
  offerId: string | null;
  rows: Offer[];
}) {
  return (
    <section className={`${CARD} overflow-hidden p-0 md:p-0`} data-testid="fare-matrix">
      <div className="border-b border-line px-6 py-4 md:px-8">
        <p className={LABEL}>Fare families</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-copy-muted">
              <th className="px-6 py-3 font-bold md:px-8">Fare family</th>
              <th className="px-4 py-3 font-bold">Baggage</th>
              <th className="px-4 py-3 font-bold">Change</th>
              <th className="px-6 py-3 font-bold md:px-8">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={row.id === offerId ? "bg-gold-soft/60 font-bold text-navy" : "text-copy"}
              >
                <td className="px-6 py-3.5 md:px-8">
                  <Link
                    href={`/flights/review?sid=${sid}&offer=${encodeURIComponent(row.id)}`}
                    className={`rounded-sm hover:text-gold-dark ${FOCUS}`}
                  >
                    {row.brandedFare}
                  </Link>
                </td>
                <td className="px-4 py-3.5">{row.baggage?.checked ?? "—"}</td>
                <td className="px-4 py-3.5">{row.refundable ? "Refundable" : "Non-refundable"}</td>
                <td className="px-6 py-3.5 tabular-nums md:px-8">{row.fare?.totalLabel ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportantFareInformation({ offer }: { offer: Offer }) {
  return (
    <section className={CARD}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-field text-navy">
          <InfoIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-navy">Important fare information</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoRow label="Cabin baggage" value={offer.baggage?.cabin ?? "—"} />
            <InfoRow label="Checked baggage" value={offer.baggage?.checked ?? "—"} />
            <InfoRow label="Fare conditions" value={offer.refundable ? "Refundable" : "Non-refundable"} />
            <RefundCancellationCard offer={offer} />
            <InfoRow
              label="Revalidation"
              value="Continue to revalidate this fare and enter traveler details. You will need to sign in."
              wide
            />
          </dl>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl bg-field px-4 py-3${wide ? " sm:col-span-2" : ""}`}>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-navy">{value}</dd>
    </div>
  );
}

function RefundCancellationCard({ offer }: { offer: Offer }) {
  const refund = refundPresentation(offer);
  return (
    <div className="min-w-0 rounded-xl bg-field px-4 py-3">
      <p className={LABEL}>Refund / cancellation</p>
      <dl className="mt-3 space-y-3">
        <div className="min-w-0">
          <dt className={LABEL}>Refundable amount</dt>
          <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-navy">{refund.amountText}</dd>
        </div>
        <div className="min-w-0">
          <dt className={LABEL}>{refund.feeLabel}</dt>
          <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-navy">{refund.feeText}</dd>
        </div>
      </dl>
    </div>
  );
}

function PriceSummaryCard({ offer, continueHref }: { offer: Offer; continueHref: string }) {
  const fare = offer.fare;
  const rows = fareBreakdownRows(fare);
  const refund = refundPresentation(offer);

  return (
    <section className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_12px_32px_rgba(16,23,42,0.06)]">
      <div className="h-1 bg-gold" aria-hidden />
      <div className="p-5 md:p-6">
        <p className={LABEL}>Price summary</p>
        <div className="mt-5" data-testid="price-breakdown">
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium text-copy-muted">{row.label}</span>
                <span className="tabular-nums font-semibold text-navy">{formatFareMoney(fare.currency, row.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-field px-4 py-4">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-copy-muted">Total fare</p>
                <p className="mt-1 text-xs font-semibold text-copy-muted">Final payable</p>
              </div>
              <p className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-navy">
                {fare.totalLabel}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5 border-t border-line pt-4" data-testid="refund-summary">
            <li className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 font-medium text-copy-muted">Refundable amount</span>
              <span className="shrink-0 text-right font-semibold tabular-nums text-navy">{refund.amountText}</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 font-medium text-copy-muted">{refund.feeLabel}</span>
              <span className="shrink-0 text-right font-semibold tabular-nums text-navy">{refund.feeText}</span>
            </li>
          </ul>
        </div>
        <Link
          href={continueHref}
          data-testid="continue-booking"
          aria-label={`Continue to booking, ${fare.totalLabel}`}
          className={`mt-6 flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-navy text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold ${FOCUS}`}
        >
          Continue to booking
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8h.01" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d4af37]/20 border-t-[#d4af37]" />
        </div>
      }
    >
      <ReviewInner />
    </Suspense>
  );
}
