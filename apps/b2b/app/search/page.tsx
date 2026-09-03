"use client";

import { AgencyShell } from "../components/AgencyShell";
import { useRouter } from "next/navigation";
import { useState } from "react";

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export default function AgencySearchPage() {
  const router = useRouter();
  const [product, setProduct] = useState<"flights" | "hotels">("flights");
  const [form, setForm] = useState({
    origin: "DAC",
    destination: "DXB",
    date: tomorrow(),
    adults: "1",
    children: "0",
    infants: "0",
    cabin: "ECONOMY",
  });
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.origin || !form.destination || !form.date) {
      setError("Origin, destination, and date are required.");
      return;
    }
    const query = new URLSearchParams({
      from: form.origin.trim().slice(0, 3).toUpperCase(),
      to: form.destination.trim().slice(0, 3).toUpperCase(),
      date: form.date,
      adults: form.adults,
      children: form.children,
      infants: form.infants,
      cabin: form.cabin,
      type: "one-way",
    });
    router.push(`/flights?${query.toString()}`);
  };

  const submitHotel = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.destination || !form.date) {
      setError("Destination and check-in date are required.");
      return;
    }
    const checkOut = new Date(`${form.date}T00:00:00Z`);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);
    const query = new URLSearchParams({
      city: form.destination.trim(),
      checkIn: form.date,
      checkOut: checkOut.toISOString().slice(0, 10),
      rooms: "1",
      adults: form.adults,
      children: form.children,
    });
    router.push(`/hotels?${query.toString()}`);
  };

  return (
    <AgencyShell>
      <main className="p-8 max-w-4xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{product === "hotels" ? "Hotels" : "Flights"}</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Search</h1>
        <div className="flex gap-2 mb-6 bg-white border border-slate-100 rounded-2xl p-2 w-fit">
          <button type="button" onClick={() => setProduct("flights")} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${product === "flights" ? "bg-ink text-white" : "text-slate-400"}`}>Flights</button>
          <button type="button" onClick={() => setProduct("hotels")} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${product === "hotels" ? "bg-ink text-white" : "text-slate-400"}`}>Hotels</button>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {product === "flights" ? (
        <form onSubmit={submit} className="bg-white border border-slate-100 rounded-[2rem] p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Origin
            <input className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none uppercase" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Destination
            <input className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none uppercase" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Date
            <input type="date" className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Adults
            <select className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Children
            <select className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })}>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Infants
            <select className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.infants} onChange={(e) => setForm({ ...form, infants: e.target.value })}>
              {[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
            Cabin
            <select className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.cabin} onChange={(e) => setForm({ ...form, cabin: e.target.value })}>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </label>
          <button className="bg-ink text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gold">
            Search flights
          </button>
        </form>
        ) : (
        <form onSubmit={submitHotel} className="bg-white border border-slate-100 rounded-[2rem] p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
            Destination
            <input className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="DAC or Dubai" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Check-in
            <input type="date" className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Adults
            <select className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Children
            <select className="mt-2 w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })}>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="bg-ink text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gold">
            Search hotels
          </button>
        </form>
        )}
      </main>
    </AgencyShell>
  );
}
