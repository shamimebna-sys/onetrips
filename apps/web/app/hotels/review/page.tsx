"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ErrorState, PriceBreakdown } from "@onetrips/ui";

type Offer = {
  id: string;
  name: string;
  starRating: number;
  city: string;
  address: string;
  board: string;
  cabinLabel: string;
  brandedFare: string;
  refundable: boolean;
  nights: number;
  checkIn: string;
  checkOut: string;
  room: { name: string; bedType: string };
  cancellationPolicy?: { summary: string };
  fare: {
    totalLabel: string;
    currency?: string;
    base?: number;
    taxes?: number;
    markup?: number;
    serviceFee?: number;
    discount?: number;
    total?: number;
  };
};

function ReviewInner() {
  const params = useSearchParams();
  const sid = params.get("sid");
  const offerId = params.get("offer");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sid || !offerId) return;
    fetch(`/api/hotels/sessions/${sid}/offers/${encodeURIComponent(offerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.offer) setOffer(data.offer);
        else setError(data.message || "Room not found");
      });
  }, [sid, offerId]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link href={`/hotels?sid=${sid ?? ""}`} className="mb-6 inline-block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Back to results
        </Link>
        {error ? (
          <ErrorState
            title="This room is no longer available"
            description={error}
            action={
              <Link href="/hotels" className="font-black uppercase tracking-widest text-gold-dark">
                Search again
              </Link>
            }
          />
        ) : null}
        {!offer && !error && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
          </div>
        )}
        {offer && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 md:p-12 space-y-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Selected stay</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter mt-2">{offer.fare.totalLabel}</h1>
              <p className="text-sm font-medium text-slate-500 mt-2">
                {offer.name} · {offer.starRating} star · {offer.refundable ? "Refundable" : "Non-refundable"}
              </p>
            </div>
            <div className="border border-slate-100 rounded-3xl p-6 space-y-2">
              <p className="font-black uppercase">{offer.room.name}</p>
              <p className="text-sm text-slate-500">{offer.board} · {offer.room.bedType}</p>
              <p className="text-sm text-slate-500">{offer.checkIn} to {offer.checkOut} · {offer.nights} night{offer.nights > 1 ? "s" : ""}</p>
              <p className="text-sm text-slate-500">{offer.address}, {offer.city}</p>
              {offer.cancellationPolicy?.summary ? <p className="text-sm text-slate-500">{offer.cancellationPolicy.summary}</p> : null}
            </div>
            <PriceBreakdown
              currency={offer.fare.currency ?? "BDT"}
              base={offer.fare.base}
              taxes={offer.fare.taxes}
              markup={offer.fare.markup}
              serviceFee={offer.fare.serviceFee}
              discount={offer.fare.discount}
              total={offer.fare.total ?? 0}
            />
            <div className="bg-slate-50 rounded-3xl p-6 text-sm font-medium text-slate-600">
              Continue to revalidate this rate and enter guest details. You will need to sign in. Payment, vouchers, and invoices reuse the existing booking engines.
            </div>
            <Link
              href={`/booking/start?sid=${sid}&offer=${encodeURIComponent(offerId ?? "")}&product=HOTEL`}
              data-testid="continue-booking"
              className="sticky bottom-24 z-30 block w-full scroll-mb-28 text-center bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#d4af37] md:static"
            >
              Continue to booking
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function HotelReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      }
    >
      <ReviewInner />
    </Suspense>
  );
}
