"use client";

import { AgencyShell } from "../components/AgencyShell";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Offer = {
  id: string;
  cabinLabel: string;
  brandedFare: string;
  fare: { totalLabel: string };
  itineraries: Array<{
    durationLabel: string;
    stopsLabel: string;
    segments: Array<{
      origin: string;
      destination: string;
      departureTime: string;
      arrivalTime: string;
      airlineName: string;
      flightNumber: string;
    }>;
  }>;
};

function ResultsInner() {
  const params = useSearchParams();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = params.get("sid");
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        if (sid) {
          const res = await fetch(`/api/flights/sessions/${sid}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Search expired");
          setSessionId(data.sessionId);
          setOffers(data.offers ?? []);
          return;
        }
        const body = {
          tripType: params.get("type") || "one-way",
          segments: [{ origin: params.get("from"), destination: params.get("to"), date: params.get("date") }],
          adults: Number(params.get("adults") ?? 1),
          children: Number(params.get("children") ?? 0),
          infants: Number(params.get("infants") ?? 0),
          cabin: (params.get("cabin") ?? "ECONOMY").toUpperCase(),
        };
        const res = await fetch("/api/flights/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Unable to search");
        setSessionId(data.sessionId);
        setOffers(data.offers ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to search");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [params]);

  return (
    <AgencyShell>
      <main className="p-8 max-w-5xl">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Flights</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Results</h1>
          </div>
          <Link href="/search" className="text-[10px] font-black uppercase tracking-widest text-[#996515]">New search</Link>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {loading && <p className="text-sm font-bold text-slate-400">Searching with B2B pricing…</p>}
        {!loading && offers.map((offer) => {
          const first = offer.itineraries[0]?.segments[0];
          const last = offer.itineraries[0]?.segments[offer.itineraries[0].segments.length - 1];
          return (
            <article key={offer.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="font-black uppercase">{first?.airlineName} {first?.flightNumber}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {first?.departureTime} {first?.origin} → {last?.arrivalTime} {last?.destination} · {offer.itineraries[0]?.durationLabel} · {offer.cabinLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black">{offer.fare.totalLabel}</p>
                <Link
                  href={`/flights/review?sid=${sessionId}&offer=${encodeURIComponent(offer.id)}`}
                  className="inline-block mt-3 bg-ink text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gold"
                >
                  Select
                </Link>
              </div>
            </article>
          );
        })}
      </main>
    </AgencyShell>
  );
}

export default function AgencyFlightsPage() {
  return (
    <Suspense fallback={<AgencyShell><main className="p-8">Loading…</main></AgencyShell>}>
      <ResultsInner />
    </Suspense>
  );
}
