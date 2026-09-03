"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@onetrips/ui";

type Offer = { code: string; name: string; description: string | null; endsAt: string };

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  useEffect(() => {
    fetch("/api/offers")
      .then((res) => res.json())
      .then((data) => setOffers(data.offers ?? []));
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <h1 className="text-4xl font-black uppercase tracking-tighter">Offers</h1>
      {offers.length === 0 ? (
        <EmptyState
          title="No live campaigns"
          description="Promo codes will appear here when a campaign is active."
          action={
            <Link href="/flights" className="inline-flex rounded-xl bg-ink px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white">
              Search flights
            </Link>
          }
        />
      ) : (
        offers.map((offer) => (
          <article key={offer.code} className="rounded-[2rem] border border-slate-100 bg-white p-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-gold-dark">{offer.code}</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tighter">{offer.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{offer.description}</p>
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Ends {new Date(offer.endsAt).toLocaleDateString()}
            </p>
          </article>
        ))
      )}
    </main>
  );
}
