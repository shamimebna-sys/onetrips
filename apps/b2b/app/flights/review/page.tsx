"use client";

import { AgencyShell } from "../../components/AgencyShell";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Offer = {
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

function ReviewInner() {
  const params = useSearchParams();
  const sid = params.get("sid");
  const offerId = params.get("offer");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sid || !offerId) return;
    fetch(`/api/flights/sessions/${sid}/offers/${encodeURIComponent(offerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.offer) setOffer(data.offer);
        else setError(data.message || "Fare not found");
      });
  }, [sid, offerId]);

  return (
    <AgencyShell>
      <main className="p-8 max-w-4xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Fare</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Review</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {offer && (
          <div className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-6">
            <p className="text-2xl font-black">{offer.fare.totalLabel}</p>
            <p className="text-sm text-slate-500">{offer.cabinLabel} · {offer.brandedFare}. Price is quoted by the server-side B2B engine.</p>
            {offer.itineraries.map((itinerary, index) => (
              <div key={index} className="border border-slate-100 rounded-3xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#996515] mb-3">
                  {itinerary.durationLabel} · {itinerary.stopsLabel}
                </p>
                {itinerary.segments.map((leg) => (
                  <p key={leg.flightNumber} className="text-sm font-medium py-1">
                    {leg.airlineName} {leg.flightNumber} · {leg.departureTime} {leg.origin} → {leg.arrivalTime} {leg.destination}
                  </p>
                ))}
              </div>
            ))}
            <Link
              href={`/booking/start?sid=${sid}&offer=${encodeURIComponent(offerId ?? "")}`}
              className="block text-center bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold"
            >
              Revalidate and book
            </Link>
          </div>
        )}
      </main>
    </AgencyShell>
  );
}

export default function AgencyReviewPage() {
  return (
    <Suspense fallback={<AgencyShell><main className="p-8">Loading…</main></AgencyShell>}>
      <ReviewInner />
    </Suspense>
  );
}
