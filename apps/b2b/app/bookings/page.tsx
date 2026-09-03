"use client";

import { AgencyShell } from "../components/AgencyShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  bookingRef: string;
  pnr: string | null;
  status: string;
  ticketStatus: string | null;
  totalAmount: number;
  currency: string;
  origin?: string;
  destination?: string;
  departureAt: string | null;
  passenger: string | null;
  invoice: { invoiceNo: string; pdfUrl: string } | null;
};

export default function AgencyBookingsPage() {
  const [bookings, setBookings] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bookings")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setError(data.message || "Unable to load bookings");
        else setBookings(data.bookings ?? []);
      });
  }, []);

  return (
    <AgencyShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Agency</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Bookings</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-x-auto">
          {bookings.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No organization bookings yet.</p>}
          {bookings.map((row) => (
            <Link key={row.id} href={`/booking/${row.id}`} className="px-8 py-5 border-t border-slate-50 first:border-t-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50">
              <div>
                <p className="font-black uppercase tracking-tight">{row.bookingRef}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  PNR {row.pnr || "—"} · {row.passenger || "No passenger yet"} · {row.origin || "—"} → {row.destination || "—"}
                  {row.departureAt ? ` · ${new Date(row.departureAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black">{row.currency} {row.totalAmount.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {row.status} · Ticket {row.ticketStatus || "—"} · Invoice {row.invoice?.invoiceNo || "—"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </AgencyShell>
  );
}
