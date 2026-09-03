import Link from "next/link";

export type FlightOfferCardData = {
  id: string;
  cabinLabel: string;
  brandedFare: string;
  refundable: boolean;
  seatsLeft: number;
  baggage: { cabin: string; checked: string };
  fare: { totalLabel: string };
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
      airlineCode: string;
      airlineName: string;
      flightNumber: string;
    }>;
  }>;
};

const LEGS_GRID =
  "grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_6.75rem_5.5rem_6.75rem] md:gap-x-4 md:gap-y-4";

const LEG_GRID =
  "grid min-w-0 grid-cols-3 items-center gap-3 md:col-span-4 md:grid-cols-subgrid";

const TIME = "text-xl font-bold leading-6 tabular-nums text-navy";
const PLACE = "mt-1 block h-4 truncate text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-copy-muted";

function AirlineCell({ code, name, meta }: { code: string; name: string; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-[11px] font-bold text-white">
        {code}
      </span>
      <div className="min-w-0 overflow-hidden">
        <p className="h-5 truncate text-sm font-bold uppercase leading-5 tracking-tight text-navy" title={name}>
          {name}
        </p>
        <p className="mt-0.5 h-4 truncate text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-copy-muted" title={meta}>
          {meta}
        </p>
      </div>
    </div>
  );
}

function TimeCell({
  time,
  place,
  offset,
  align,
}: {
  time: string;
  place: string;
  offset?: number;
  align: "left" | "right";
}) {
  return (
    <div className={`min-w-0 overflow-hidden ${align === "right" ? "text-right" : "text-left"}`}>
      <p className={TIME}>
        {time}
        {offset && offset > 0 ? <span className="text-xs font-bold text-gold-dark"> +{offset}</span> : null}
      </p>
      <p className={PLACE} title={place}>
        {place}
      </p>
    </div>
  );
}

function DurationCell({ duration, stops }: { duration: string; stops: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center overflow-hidden text-center">
      <p className="h-4 w-full truncate text-xs font-bold uppercase leading-4 tracking-[0.12em] text-gold-dark" title={duration}>
        {duration}
      </p>
      <div className="my-1.5 h-px w-10 shrink-0 bg-line" />
      <p className="h-4 w-full truncate text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-copy-muted" title={stops}>
        {stops}
      </p>
    </div>
  );
}

export function FlightOfferCard({
  offer,
  selectHref,
}: {
  offer: FlightOfferCardData;
  selectHref: string;
}) {
  const footer = `Cabin ${offer.baggage.cabin} · Checked ${offer.baggage.checked}${offer.refundable ? " · Refundable" : " · Non-refundable"} · ${offer.seatsLeft} seats left`;
  return (
    <article className="grid min-w-0 grid-cols-1 gap-4 overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-[0_8px_28px_rgba(16,23,42,0.04)] md:grid-cols-[minmax(0,1fr)_9rem] md:items-stretch md:gap-x-6">
      <div className="flex min-w-0 flex-col gap-4 max-md:contents">
        <div className={`${LEGS_GRID} max-md:order-1`}>
          {offer.itineraries.map((itinerary, index) => {
            const first = itinerary.segments[0];
            const last = itinerary.segments[itinerary.segments.length - 1];
            const meta = `${itinerary.segments.map((leg) => leg.flightNumber).join(" · ")} · ${offer.cabinLabel} · ${offer.brandedFare}`;
            return (
              <div key={`${offer.id}-${index}`} className={`${LEG_GRID} ${index > 0 ? "border-t border-line pt-4" : ""}`}>
                <div className="col-span-3 min-w-0 overflow-hidden md:col-auto">
                  <AirlineCell code={first.airlineCode} name={first.airlineName} meta={meta} />
                </div>
                <TimeCell time={first.departureTime} place={`${first.origin} · ${first.originCity}`} align="left" />
                <DurationCell duration={itinerary.durationLabel} stops={itinerary.stopsLabel} />
                <TimeCell
                  time={last.arrivalTime}
                  place={`${last.destination} · ${last.destinationCity}`}
                  offset={itinerary.arrivalDayOffset}
                  align="right"
                />
              </div>
            );
          })}
        </div>
        <p className="min-w-0 truncate text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-copy-muted max-md:order-3" title={footer}>
          {footer}
        </p>
      </div>
      <div className="flex min-h-0 w-full min-w-0 flex-col items-center justify-center self-stretch max-md:order-2">
        <div className="flex w-full flex-col items-center gap-2.5">
          <p className="h-6 max-w-full truncate text-center text-xl font-bold leading-6 tabular-nums text-navy" title={offer.fare.totalLabel}>
            {offer.fare.totalLabel}
          </p>
          <Link
            href={selectHref}
            data-testid="select-fare"
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-navy text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold"
          >
            Select
          </Link>
        </div>
      </div>
    </article>
  );
}
