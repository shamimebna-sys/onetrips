"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { EmptyState, ErrorState, PriceBreakdown } from "@onetrips/ui";

type Room = {
  id: string;
  room: { name: string; bedType: string };
  board: string;
  refundable: boolean;
  roomsLeft: number;
  cancellationPolicy?: { summary: string };
  fare: { totalLabel: string; currency?: string; base: number; taxes: number; markup?: number; serviceFee?: number; discount?: number; total?: number };
};

type Details = {
  sessionId: string;
  hotel: {
    hotelId: string;
    name: string;
    starRating: number;
    city: string;
    address: string;
    amenities: string[];
    checkIn: string;
    checkOut: string;
    nights: number;
    images?: string[];
    description?: string | null;
    location?: { text?: string };
    cancellationPolicy?: { refundable: boolean; deadline?: string | null; summary: string };
  };
  rooms: Room[];
};

function DetailsInner() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const params = useSearchParams();
  const sid = params.get("sid");
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sid || !hotelId) return;
    fetch(`/api/hotels/sessions/${sid}/hotels/${encodeURIComponent(hotelId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.hotel) setData(body);
        else setError(body.message || "Hotel not found");
      });
  }, [sid, hotelId]);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <ErrorState
          title="This hotel is no longer available"
          description={error}
          action={
            <Link href="/hotels" className="font-black uppercase tracking-widest text-gold-dark">
              View alternatives
            </Link>
          }
        />
      </main>
    );
  }
  if (!data) {
    return <div className="flex min-h-[40vh] items-center justify-center">Loading</div>;
  }

  const images = data.hotel.images?.length ? data.hotel.images : [];

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Link href={`/hotels?sid=${sid}`} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Back to results
      </Link>
      {images.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="hotel-gallery">
          {images.slice(0, 3).map((src) => (
            <div key={src} className="relative h-48 overflow-hidden rounded-[2rem] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 md:p-12">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{data.hotel.city}</p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tighter">{data.hotel.name}</h1>
        <p className="mt-2 flex items-center gap-1 text-sm font-medium text-slate-500">
          {Array.from({ length: data.hotel.starRating }).map((_, i) => (
            <Star key={i} size={12} className="fill-[#d4af37] text-[#d4af37]" />
          ))}
          {data.hotel.address}
        </p>
        {data.hotel.location?.text ? <p className="mt-2 text-sm text-slate-500">{data.hotel.location.text}</p> : null}
        <p className="mt-4 text-sm text-slate-600">
          {data.hotel.nights} night{data.hotel.nights > 1 ? "s" : ""} · {data.hotel.checkIn} to {data.hotel.checkOut}
        </p>
        {data.hotel.description ? <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600">{data.hotel.description}</p> : null}
        <div className="mt-6 flex flex-wrap gap-2">
          {data.hotel.amenities.map((item) => (
            <span key={item} className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {item}
            </span>
          ))}
        </div>
        {data.hotel.cancellationPolicy ? (
          <div className="mt-6 rounded-3xl bg-slate-50 p-5" data-testid="hotel-cancellation">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cancellation policy</p>
            <p className="mt-2 text-sm font-medium text-slate-600">{data.hotel.cancellationPolicy.summary}</p>
          </div>
        ) : null}
      </div>
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-tighter">Rooms</h2>
        {data.rooms.length === 0 ? <EmptyState title="No rooms left" /> : null}
        {data.rooms.map((room) => (
          <article key={room.id} className="flex flex-col justify-between gap-4 rounded-[2rem] border border-slate-100 bg-white p-6 md:flex-row">
            <div>
              <p className="font-black uppercase">{room.room.name}</p>
              <p className="text-sm text-slate-500">
                {room.room.bedType} · {room.board} · {room.refundable ? "Free cancellation" : "Non-refundable"}
              </p>
              {room.cancellationPolicy?.summary ? <p className="mt-2 text-xs text-slate-500">{room.cancellationPolicy.summary}</p> : null}
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Base {room.fare.base.toLocaleString()} · Taxes {room.fare.taxes.toLocaleString()} · {room.roomsLeft} left
              </p>
            </div>
            <div className="md:w-56">
              <p className="mb-3 text-2xl font-black">{room.fare.totalLabel}</p>
              <PriceBreakdown
                currency={room.fare.currency ?? "BDT"}
                base={room.fare.base}
                taxes={room.fare.taxes}
                markup={room.fare.markup}
                serviceFee={room.fare.serviceFee}
                discount={room.fare.discount}
                total={room.fare.total ?? room.fare.base + room.fare.taxes}
              />
              <Link
                href={`/hotels/review?sid=${data.sessionId}&offer=${encodeURIComponent(room.id)}`}
                data-testid="select-room"
                className="mt-4 block w-full rounded-2xl bg-ink py-3 text-center text-[11px] font-black uppercase tracking-widest text-white hover:bg-gold"
              >
                Select room
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function HotelDetailsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center">Loading</div>}>
      <DetailsInner />
    </Suspense>
  );
}
