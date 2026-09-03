"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Hotel, Loader2, Star } from "lucide-react";
import { Modal } from "@onetrips/ui";
import { CustomerSearch } from "@/components/search/CustomerSearch";

type Offer = {
  id: string;
  hotelId: string;
  name: string;
  starRating: number;
  city: string;
  cityCode: string;
  address: string;
  board: string;
  cabinLabel: string;
  brandedFare: string;
  refundable: boolean;
  roomsLeft: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  amenities: string[];
  room: { name: string; bedType: string; maxOccupancy: number };
  fare: { total: number; totalLabel: string; currency: string };
};

type Result = {
  sessionId: string;
  expiresAt: string;
  total: number;
  errors: Array<{ provider: string; message: string }>;
  request: {
    cityName: string;
    cityCode: string;
    checkIn: string;
    checkOut: string;
    rooms: number;
    adults: number;
    children: number;
  };
  offers: Offer[];
};

export function HotelResultsClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recommended");
  const [refundable, setRefundable] = useState(false);
  const [minStars, setMinStars] = useState("");
  const [board, setBoard] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState({
    destination: params.get("city") || params.get("to") || "",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    rooms: params.get("rooms") || "1",
    adults: params.get("adults") || "1",
    children: params.get("children") || "0",
  });

  const sid = params.get("sid");

  const runSearch = async () => {
    if (!sid && !form.destination) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (sort !== "recommended") query.set("sort", sort);
      if (refundable) query.set("refundable", "true");
      if (minStars) query.set("minStars", minStars);
      if (board) query.set("board", board);

      if (sid) {
        const res = await fetch(`/api/hotels/sessions/${sid}?${query.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Search expired");
        setResult(data);
        return;
      }

      const res = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: form.destination,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          rooms: Number(form.rooms),
          adults: Number(form.adults),
          children: Number(form.children),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to search hotels");
      setResult(data);
      const next = new URLSearchParams(params.toString());
      next.set("sid", data.sessionId);
      router.replace(`/hotels?${next.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to search hotels");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, sort, refundable, minStars, board]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <CustomerSearch
          panelClassName="mb-8"
          product="hotels"
          onProductChange={(id) => {
            if (id === "flights") router.push("/flights");
          }}
          loading={loading}
          hotels={{
            destination: form.destination,
            checkIn: form.checkIn,
            checkOut: form.checkOut,
            rooms: form.rooms,
            adults: form.adults,
            children: form.children,
            onDestination: (destination) => setForm({ ...form, destination }),
            onCheckIn: (checkIn) => setForm({ ...form, checkIn }),
            onCheckOut: (checkOut) => setForm({ ...form, checkOut }),
            onRooms: (rooms) => setForm({ ...form, rooms }),
            onAdults: (adults) => setForm({ ...form, adults }),
            onChildren: (children) => setForm({ ...form, children }),
            onSearch: () => {
              const query = new URLSearchParams({
                city: form.destination,
                checkIn: form.checkIn,
                checkOut: form.checkOut,
                rooms: form.rooms,
                adults: form.adults,
                children: form.children,
              });
              router.push(`/hotels?${query.toString()}`);
            },
          }}
        />

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-[#d4af37]" />
          </div>
        )}

        {!loading && result && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:hidden">
              <button
                type="button"
                data-testid="open-hotel-filters"
                onClick={() => setFiltersOpen(true)}
                className="w-full rounded-2xl border border-slate-100 bg-white py-3 text-[11px] font-black uppercase tracking-widest"
              >
                Filters
              </button>
            </div>
            <aside className="hidden bg-white rounded-[2rem] border border-slate-100 p-6 h-fit space-y-4 lg:block">
              <HotelFilterFields refundable={refundable} minStars={minStars} board={board} setRefundable={setRefundable} setMinStars={setMinStars} setBoard={setBoard} />
            </aside>
            <Modal open={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
              <HotelFilterFields refundable={refundable} minStars={minStars} board={board} setRefundable={setRefundable} setMinStars={setMinStars} setBoard={setBoard} />
              <button
                type="button"
                className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-[11px] font-black uppercase tracking-widest text-white"
                onClick={() => setFiltersOpen(false)}
              >
                Show results
              </button>
            </Modal>
            <section className="lg:col-span-3 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-500">
                  <span className="font-black text-slate-900">{result.total}</span> rooms in {result.request.cityName}
                </p>
                <div className="flex gap-2">
                  {[
                    { id: "recommended", label: "Recommended" },
                    { id: "price", label: "Cheapest" },
                    { id: "stars", label: "Stars" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSort(item.id)}
                      className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        sort === item.id ? "bg-slate-900 text-white" : "bg-white text-slate-400 border border-slate-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {result.offers.map((offer) => (
                <article key={offer.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                        <Hotel size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black uppercase tracking-tight" title={offer.name}>
                          {offer.name}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                          {Array.from({ length: offer.starRating }).map((_, i) => <Star key={i} size={10} className="text-[#d4af37] fill-[#d4af37]" />)}
                          {offer.city} · {offer.cityCode}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-600">{offer.room.name} · {offer.room.bedType} · {offer.board}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                      {(offer.amenities ?? []).join(" · ")}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">
                      {offer.nights} night{offer.nights > 1 ? "s" : ""} · {offer.checkIn} to {offer.checkOut}
                      {offer.refundable ? " · Refundable" : " · Non-refundable"} · {offer.roomsLeft} rooms left
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 flex-col items-stretch justify-center gap-3 md:w-48">
                    <p className="text-right text-2xl font-black tabular-nums text-slate-900" title={offer.fare.totalLabel}>
                      {offer.fare.totalLabel}
                    </p>
                    <Link
                      href={`/hotels/${encodeURIComponent(offer.hotelId)}?sid=${result.sessionId}`}
                      data-testid="select-hotel"
                      className="w-full text-center bg-slate-900 text-white py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#d4af37]"
                    >
                      View hotel
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function HotelFilterFields({
  refundable,
  minStars,
  board,
  setRefundable,
  setMinStars,
  setBoard,
}: {
  refundable: boolean;
  minStars: string;
  board: string;
  setRefundable: (value: boolean) => void;
  setMinStars: (value: string) => void;
  setBoard: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter</p>
      <label className="flex min-h-9 items-center gap-2.5 text-sm font-bold text-slate-600">
        <input type="checkbox" className="size-4 shrink-0 accent-navy" checked={refundable} onChange={(e) => setRefundable(e.target.checked)} />
        Refundable only
      </label>
      <label className="block text-sm font-bold text-slate-600">
        Minimum stars
        <select className="mt-2 w-full rounded-xl bg-slate-50 p-3" value={minStars} onChange={(e) => setMinStars(e.target.value)}>
          <option value="">Any</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
          <option value="5">5</option>
        </select>
      </label>
      <label className="block text-sm font-bold text-slate-600">
        Board
        <select className="mt-2 w-full rounded-xl bg-slate-50 p-3" value={board} onChange={(e) => setBoard(e.target.value)}>
          <option value="">Any</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Room only">Room only</option>
          <option value="Half board">Half board</option>
        </select>
      </label>
    </div>
  );
}
