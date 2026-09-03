"use client";

import { AdminShell } from "../components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Row = {
  id: string;
  bookingRef: string;
  status: string;
  totalAmount: number;
  currency: string;
  origin: string | null;
  destination: string | null;
  ownerEmail: string | null;
  createdAt: string;
};

function BookingsInner() {
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(params.get("status") || "ALL");

  const load = async (nextStatus = status, nextQ = q) => {
    const query = new URLSearchParams();
    if (nextStatus && nextStatus !== "ALL") query.set("status", nextStatus);
    if (nextQ) query.set("q", nextQ);
    const res = await fetch(`/api/bookings?${query.toString()}`);
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load bookings");
    else {
      setError("");
      setRows(data.bookings ?? []);
    }
  };

  useEffect(() => {
    void load(params.get("status") || "ALL", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Operations</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Bookings</h1>
        <form
          className="flex flex-col md:flex-row gap-3 mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none" placeholder="Booking ref, PNR, email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none" value={status} onChange={(e) => { setStatus(e.target.value); void load(e.target.value, q); }}>
            {["ALL", "PAYMENT_PENDING", "BOOKED", "BOOKING_UNKNOWN", "TICKETING_FAILED", "TICKETING_UNKNOWN", "TICKETED", "REFUND_PENDING", "CANCELLED", "REFUNDED", "EXPIRED"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <button className="px-6 bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">Search</button>
        </form>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {rows.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No bookings match.</p>}
          {rows.map((row) => (
            <Link key={row.id} href={`/bookings/${row.id}`} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-50">
              <div>
                <p className="font-black uppercase tracking-tight">{row.bookingRef}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {row.status} · {row.origin || "—"}–{row.destination || "—"} · {row.ownerEmail || "No owner"}
                </p>
              </div>
              <p className="font-black">{row.currency} {row.totalAmount.toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsInner />
    </Suspense>
  );
}
