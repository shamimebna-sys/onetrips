"use client";

import { AgencyShell } from "../components/AgencyShell";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Offer = {
  id: string;
  name: string;
  starRating: number;
  city: string;
  cabinLabel: string;
  brandedFare: string;
  nights: number;
  fare: { totalLabel: string };
  room: { name: string };
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
          const res = await fetch(`/api/hotels/sessions/${sid}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Search expired");
          setSessionId(data.sessionId);
          setOffers(data.offers ?? []);
          return;
        }
        const body = {
          destination: params.get("city") || params.get("to") || "",
          checkIn: params.get("checkIn"),
          checkOut: params.get("checkOut"),
          rooms: Number(params.get("rooms") ?? 1),
          adults: Number(params.get("adults") ?? 1),
          children: Number(params.get("children") ?? 0),
        };
        const res = await fetch("/api/hotels/search", {
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
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Hotels</p>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Results</h1>
          </div>
          <Link href="/search" className="text-[10px] font-black uppercase tracking-widest text-[#996515]">New search</Link>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {loading && <p className="text-sm font-bold text-slate-400">Searching with B2B pricing…</p>}
        {!loading && offers.map((offer) => (
          <article key={offer.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="font-black uppercase">{offer.name}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                {offer.starRating} star · {offer.city} · {offer.room.name} · {offer.nights} night{offer.nights > 1 ? "s" : ""} · {offer.brandedFare}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">{offer.fare.totalLabel}</p>
              <Link
                href={`/hotels/review?sid=${sessionId}&offer=${encodeURIComponent(offer.id)}`}
                className="inline-block mt-3 bg-ink text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gold"
              >
                Select
              </Link>
            </div>
          </article>
        ))}
      </main>
    </AgencyShell>
  );
}

export default function AgencyHotelsPage() {
  return (
    <Suspense fallback={<AgencyShell><main className="p-8">Loading…</main></AgencyShell>}>
      <ResultsInner />
    </Suspense>
  );
}
