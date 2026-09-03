"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@onetrips/ui";
import { FilterControlCheckbox, FilterControlRadio, FilterOptionRow } from "@/components/flights/FilterOptionRow";
import { FlightOfferCard } from "@/components/flights/FlightOfferCard";
import { CustomerSearch } from "@/components/search/CustomerSearch";
import {
  emptyMultiCitySegments,
  multiCitySearchBody,
  parseMultiCitySegments,
  type FlightTripType,
} from "@/components/search/flightSearchQuery";

type Offer = {
  id: string;
  cabinLabel: string;
  brandedFare: string;
  refundable: boolean;
  seatsLeft: number;
  baggage: { cabin: string; checked: string };
  fare: { total: number; totalLabel: string; currency: string };
  itineraries: Array<{
    durationLabel: string;
    stopsLabel: string;
    stops: number;
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
      durationLabel: string;
    }>;
  }>;
};

type Facets = {
  minPrice: number;
  maxPrice: number;
  airlines: Array<{ code: string; name: string; count: number; minPrice: number }>;
  stops: Array<{ value: number; label: string; count: number }>;
};

type Result = {
  sessionId: string;
  expiresAt: string;
  total: number;
  errors: Array<{ provider: string; message: string }>;
  request: {
    tripType: string;
    cabin: string;
    adults: number;
    children: number;
    infants: number;
    segments: Array<{ origin: string; destination: string; date: string }>;
  };
  offers: Offer[];
  facets: Facets;
};

const sorts = [
  { id: "recommended", label: "Recommended" },
  { id: "price", label: "Cheapest" },
  { id: "duration", label: "Fastest" },
  { id: "departure", label: "Departure" },
] as const;

export function ResultsClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recommended");
  const [stops, setStops] = useState<number[]>([]);
  const [airlines, setAirlines] = useState<string[]>([]);
  const [refundable, setRefundable] = useState(false);
  const [departPeriod, setDepartPeriod] = useState("");
  const [arrivePeriod, setArrivePeriod] = useState("");
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number | "">("");
  const [baggage, setBaggage] = useState(false);
  const [fareFamily, setFareFamily] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState({
    type: (params.get("type") || "one-way") as FlightTripType,
    from: params.get("from") || "",
    to: params.get("to") || "",
    date: params.get("date") || "",
    returnDate: params.get("return") || "",
    adults: params.get("adults") || "1",
    cabin: params.get("cabin") || "ECONOMY",
  });
  const [multiCitySegments, setMultiCitySegments] = useState(() =>
    params.get("type") === "multi-city" ? parseMultiCitySegments(params.get("segments")) : emptyMultiCitySegments(),
  );

  const sid = params.get("sid");
  const tripTypeParam = params.get("type") || "one-way";
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const dateParam = params.get("date");
  const returnParam = params.get("return");
  const adultsParam = params.get("adults") ?? "1";
  const cabinParam = (params.get("cabin") ?? "ECONOMY").toUpperCase();
  const segmentsParam = params.get("segments");
  const childrenParam = params.get("children") ?? "0";
  const infantsParam = params.get("infants") ?? "0";
  const searchKey = sid
    ? `sid:${sid}`
    : tripTypeParam === "multi-city"
      ? `multi:${segmentsParam}:${adultsParam}:${cabinParam}:${childrenParam}:${infantsParam}`
      : `q:${tripTypeParam}:${fromParam}:${toParam}:${dateParam}:${returnParam}:${adultsParam}:${cabinParam}:${childrenParam}:${infantsParam}`;

  const searchBody = useMemo(() => {
    if (form.type === "multi-city") {
      return multiCitySearchBody(multiCitySegments, form.adults, form.cabin);
    }
    const segments = [{ origin: form.from, destination: form.to, date: form.date }];
    if (form.type === "round-trip") {
      segments.push({ origin: form.to, destination: form.from, date: form.returnDate });
    }
    return {
      tripType: form.type,
      segments,
      adults: Number(form.adults),
      children: 0,
      infants: 0,
      cabin: form.cabin,
    };
  }, [form, multiCitySegments]);

  const lastLoadedSid = useRef<string | null>(null);
  const searchGen = useRef(0);
  const submitLock = useRef(false);

  const runSearch = async (body: unknown) => {
    const gen = ++searchGen.current;
    setError("");
    const firstLoad = lastLoadedSid.current === null;
    if (firstLoad) setLoading(true);
    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (gen !== searchGen.current) return;
      if (!res.ok) {
        setError(data.message || "Unable to search flights");
        if (firstLoad) setResult(null);
        return;
      }
      if (!data?.sessionId) {
        setError(data.message || "Unable to search flights");
        if (firstLoad) setResult(null);
        return;
      }
      setResult(data);
      setMaxPrice("");
      setStops([]);
      setAirlines([]);
      lastLoadedSid.current = data.sessionId;
      if (params.get("sid") !== data.sessionId) {
        router.replace(`/flights?sid=${data.sessionId}`);
      }
    } catch (err) {
      if (gen !== searchGen.current) return;
      setError(err instanceof Error ? err.message : "Unable to search flights");
      if (firstLoad) setResult(null);
    } finally {
      if (gen === searchGen.current) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (sid) {
          if (lastLoadedSid.current === sid) {
            return;
          }
          if (lastLoadedSid.current === null) setLoading(true);
          setError("");
          const res = await fetch(`/api/flights/sessions/${sid}`);
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (!res.ok) {
            setError(data.message || "Search expired");
            setResult(null);
            return;
          }
          setResult(data);
          lastLoadedSid.current = sid;
          const first = data.request.segments[0];
          const last = data.request.segments[data.request.segments.length - 1];
          setForm({
            type: (data.request.tripType === "round-trip" || data.request.tripType === "multi-city"
              ? data.request.tripType
              : "one-way") as FlightTripType,
            from: first.origin,
            to: data.request.tripType === "round-trip" ? last.origin : first.destination,
            date: first.date,
            returnDate: data.request.tripType === "round-trip" ? last.date : "",
            adults: String(data.request.adults),
            cabin: data.request.cabin,
          });
          if (data.request.tripType === "multi-city") {
            setMultiCitySegments(data.request.segments);
          }
          return;
        }

        if (tripTypeParam === "multi-city" && segmentsParam) {
          await runSearch({
            ...multiCitySearchBody(
              parseMultiCitySegments(segmentsParam),
              adultsParam,
              cabinParam,
            ),
            children: Number(childrenParam),
            infants: Number(infantsParam),
          });
          return;
        }

        if (fromParam && toParam && dateParam) {
          await runSearch({
            tripType: tripTypeParam,
            segments: [
              { origin: fromParam, destination: toParam, date: dateParam },
              ...(tripTypeParam === "round-trip"
                ? [{ origin: toParam, destination: fromParam, date: returnParam }]
                : []),
            ],
            adults: Number(adultsParam),
            children: Number(childrenParam),
            infants: Number(infantsParam),
            cabin: cabinParam,
          });
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to search flights");
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  const lastFilterSession = useRef<string | null>(null);

  useEffect(() => {
    if (!result?.sessionId) return;
    if (lastFilterSession.current !== result.sessionId) {
      lastFilterSession.current = result.sessionId;
      return;
    }
    const query = new URLSearchParams();
    query.set("sort", sort);
    stops.forEach((value) => query.append("stops", String(value)));
    airlines.forEach((code) => query.append("airline", code));
    if (maxPrice) query.set("maxPrice", String(maxPrice));
    if (refundable) query.set("refundable", "true");
    if (departPeriod) query.set("departPeriod", departPeriod);
    if (arrivePeriod) query.set("arrivePeriod", arrivePeriod);
    if (maxDurationMinutes) query.set("maxDurationMinutes", String(maxDurationMinutes));
    if (baggage) query.set("baggage", "true");
    if (fareFamily) query.set("fareFamily", fareFamily);
    fetch(`/api/flights/sessions/${result.sessionId}?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.offers) setResult(data);
      });
  }, [sort, stops, airlines, maxPrice, refundable, departPeriod, arrivePeriod, maxDurationMinutes, baggage, fareFamily, result?.sessionId]);

  const toggleStop = (value: number) => {
    setStops((current) => (current.includes(value) ? current.filter((row) => row !== value) : [...current, value]));
  };
  const toggleAirline = (code: string) => {
    setAirlines((current) => (current.includes(code) ? current.filter((row) => row !== code) : [...current, code]));
  };

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <CustomerSearch
          panelClassName="mb-6"
          product="flights"
          onProductChange={(id) => {
            if (id === "hotels") router.push("/hotels");
          }}
          loading={loading}
          flights={{
            tripType: form.type === "round-trip" || form.type === "multi-city" ? form.type : "one-way",
            origin: form.from,
            destination: form.to,
            departureDate: form.date,
            returnDate: form.returnDate,
            adults: form.adults,
            cabin: form.cabin,
            segments: multiCitySegments,
            onTripTypeChange: (type) => {
              setForm({
                ...form,
                type,
                returnDate: type === "one-way" ? "" : form.returnDate,
              });
            },
            onOrigin: (from) => setForm({ ...form, from }),
            onDestination: (to) => setForm({ ...form, to }),
            onDeparture: (date) => setForm({ ...form, date }),
            onReturn: (returnDate) => setForm({ ...form, type: "round-trip", returnDate }),
            onAdults: (adults) => setForm({ ...form, adults }),
            onCabin: (cabin) => setForm({ ...form, cabin }),
            onSegments: setMultiCitySegments,
            onSearch: () => {
              if (submitLock.current || loading) return;
              submitLock.current = true;
              void runSearch(searchBody).finally(() => {
                submitLock.current = false;
              });
            },
          }}
        />

        {error && <div className="mb-6 rounded-2xl bg-red-50 p-4 text-xs font-bold uppercase tracking-widest text-red-600">{error}</div>}
        {result?.errors?.length ? (
          <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-xs font-bold uppercase tracking-widest text-amber-800">
            {result.errors.map((row) => row.message).join(" · ")}
          </div>
        ) : null}

        {loading && !result && (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold/20 border-t-gold" />
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium leading-none text-copy-muted">
                <span className="font-bold text-navy">{result.total}</span> fares · expires {new Date(result.expiresAt).toLocaleTimeString()}
              </p>
              <div className="flex flex-wrap gap-2">
                {sorts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSort(item.id)}
                    className={`inline-flex h-9 items-center rounded-full px-4 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      sort === item.id
                        ? "bg-navy text-white"
                        : "border border-line bg-white text-copy-muted hover:text-navy"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:hidden">
              <button
                type="button"
                data-testid="open-filters"
                onClick={() => setFiltersOpen(true)}
                className="h-11 w-full rounded-2xl border border-line bg-white text-[11px] font-bold uppercase tracking-widest text-navy"
              >
                Filters
              </button>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(240px,272px)_minmax(0,1fr)]">
              <aside className="hidden h-fit rounded-2xl border border-line bg-white p-5 lg:block" data-testid="flight-filters">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-copy-muted">Filters</p>
                <FlightFilterFields
                  group="aside"
                  result={result}
                  stops={stops}
                  airlines={airlines}
                  refundable={refundable}
                  departPeriod={departPeriod}
                  arrivePeriod={arrivePeriod}
                  maxDurationMinutes={maxDurationMinutes}
                  baggage={baggage}
                  fareFamily={fareFamily}
                  maxPrice={maxPrice}
                  toggleStop={toggleStop}
                  toggleAirline={toggleAirline}
                  setRefundable={setRefundable}
                  setDepartPeriod={setDepartPeriod}
                  setArrivePeriod={setArrivePeriod}
                  setMaxDurationMinutes={setMaxDurationMinutes}
                  setBaggage={setBaggage}
                  setFareFamily={setFareFamily}
                  setMaxPrice={setMaxPrice}
                />
              </aside>

              <section className="min-w-0 space-y-3">
                {result.offers.length === 0 && (
                  <div className="rounded-2xl border border-line bg-white p-8 text-sm font-semibold text-copy-muted">
                    No fares match those filters. Clear filters or search another date.
                  </div>
                )}

                {result.offers.map((offer) => (
                  <FlightOfferCard
                    key={offer.id}
                    offer={offer}
                    selectHref={`/flights/review?sid=${result.sessionId}&offer=${encodeURIComponent(offer.id)}`}
                  />
                ))}
              </section>
            </div>

            <Modal open={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
              <FlightFilterFields
                group="drawer"
                result={result}
                stops={stops}
                airlines={airlines}
                refundable={refundable}
                departPeriod={departPeriod}
                arrivePeriod={arrivePeriod}
                maxDurationMinutes={maxDurationMinutes}
                baggage={baggage}
                fareFamily={fareFamily}
                maxPrice={maxPrice}
                toggleStop={toggleStop}
                toggleAirline={toggleAirline}
                setRefundable={setRefundable}
                setDepartPeriod={setDepartPeriod}
                setArrivePeriod={setArrivePeriod}
                setMaxDurationMinutes={setMaxDurationMinutes}
                setBaggage={setBaggage}
                setFareFamily={setFareFamily}
                setMaxPrice={setMaxPrice}
              />
              <button
                type="button"
                className="mt-6 h-11 w-full rounded-2xl bg-navy text-[11px] font-bold uppercase tracking-widest text-white"
                onClick={() => setFiltersOpen(false)}
              >
                Show results
              </button>
            </Modal>
          </div>
        )}

        {!loading && !result && !error && (
          <div className="rounded-2xl border border-line bg-white p-10 text-center">
            <h1 className="mb-3 text-3xl font-black uppercase tracking-tighter text-navy">Search flights</h1>
            <p className="font-medium text-copy-muted">Enter origin, destination, and dates above. Try DAC to DXB.</p>
          </div>
        )}
      </div>
    </main>
  );
}

type FlightFilterFieldsProps = {
  group: string;
  result: Result;
  stops: number[];
  airlines: string[];
  refundable: boolean;
  departPeriod: string;
  arrivePeriod: string;
  maxDurationMinutes: number | "";
  baggage: boolean;
  fareFamily: string;
  maxPrice: number | "";
  toggleStop: (value: number) => void;
  toggleAirline: (code: string) => void;
  setRefundable: (value: boolean) => void;
  setDepartPeriod: (value: string) => void;
  setArrivePeriod: (value: string) => void;
  setMaxDurationMinutes: (value: number | "") => void;
  setBaggage: (value: boolean) => void;
  setFareFamily: (value: string) => void;
  setMaxPrice: (value: number | "") => void;
};

function FlightFilterFields({
  group,
  result,
  stops,
  airlines,
  refundable,
  departPeriod,
  arrivePeriod,
  maxDurationMinutes,
  baggage,
  fareFamily,
  maxPrice,
  toggleStop,
  toggleAirline,
  setRefundable,
  setDepartPeriod,
  setArrivePeriod,
  setMaxDurationMinutes,
  setBaggage,
  setFareFamily,
  setMaxPrice,
}: FlightFilterFieldsProps) {
  return (
    <div className="space-y-5 text-sm">
      <FilterSection title="Stops">
        {result.facets.stops.map((row) => (
          <FilterOptionRow
            key={row.value}
            label={row.label}
            count={row.count}
            control={<FilterControlCheckbox checked={stops.includes(row.value)} onChange={() => toggleStop(row.value)} />}
          />
        ))}
      </FilterSection>
      <FilterSection title="Airlines">
        {result.facets.airlines.map((row) => (
          <FilterOptionRow
            key={row.code}
            label={row.name}
            count={row.count}
            control={<FilterControlCheckbox checked={airlines.includes(row.code)} onChange={() => toggleAirline(row.code)} />}
          />
        ))}
      </FilterSection>
      <FilterSection title="Departure">
        {["", "morning", "afternoon", "evening"].map((value) => (
          <FilterOptionRow
            key={value || "any"}
            label={value === "" ? "Any time" : `${value.charAt(0).toUpperCase()}${value.slice(1)}`}
            control={
              <FilterControlRadio name={`${group}-depart`} checked={departPeriod === value} onChange={() => setDepartPeriod(value)} />
            }
          />
        ))}
      </FilterSection>
      <FilterSection title="Arrival">
        {["", "morning", "afternoon", "evening"].map((value) => (
          <FilterOptionRow
            key={value || "any-arr"}
            label={value === "" ? "Any time" : `${value.charAt(0).toUpperCase()}${value.slice(1)}`}
            control={
              <FilterControlRadio name={`${group}-arrive`} checked={arrivePeriod === value} onChange={() => setArrivePeriod(value)} />
            }
          />
        ))}
      </FilterSection>
      <FilterOptionRow
        label="Checked baggage included"
        control={<FilterControlCheckbox checked={baggage} onChange={(e) => setBaggage(e.target.checked)} />}
      />
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-copy-muted">Max duration (minutes)</span>
        <input
          type="number"
          min={60}
          value={maxDurationMinutes}
          onChange={(e) => setMaxDurationMinutes(e.target.value ? Number(e.target.value) : "")}
          className="mt-2 w-full rounded-xl bg-field p-3 font-semibold text-navy outline-none focus-visible:ring-2 ring-gold"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-copy-muted">Fare family</span>
        <input
          value={fareFamily}
          onChange={(e) => setFareFamily(e.target.value)}
          placeholder="e.g. Flex"
          className="mt-2 w-full rounded-xl bg-field p-3 font-semibold text-navy outline-none focus-visible:ring-2 ring-gold"
        />
      </label>
      <FilterOptionRow
        label="Refundable fares only"
        control={<FilterControlCheckbox checked={refundable} onChange={(e) => setRefundable(e.target.checked)} />}
      />
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-copy-muted">Max price (BDT)</span>
        <input
          type="number"
          min={result.facets.minPrice}
          max={result.facets.maxPrice}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : "")}
          placeholder={String(result.facets.maxPrice)}
          className="mt-2 w-full rounded-xl bg-field p-3 font-semibold text-navy outline-none focus-visible:ring-2 ring-gold"
        />
      </label>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-copy-muted">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
