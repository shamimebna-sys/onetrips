"use client";

import { AdminShell } from "../components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  providerRef: string | null;
  bookingId: string;
  bookingRef: string;
  createdAt: string;
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ALL");

  const load = async (next = status) => {
    const query = next !== "ALL" ? `?status=${next}` : "";
    const res = await fetch(`/api/payments${query}`);
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load payments");
    else {
      setError("");
      setRows(data.payments ?? []);
    }
  };

  useEffect(() => {
    void load("ALL");
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Payments</h1>
        <select className="bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none mb-6" value={status} onChange={(e) => { setStatus(e.target.value); void load(e.target.value); }}>
          {["ALL", "SUCCESS", "FAILED", "PENDING", "PROCESSING", "REFUND_INITIATED", "PARTIALLY_REFUNDED", "REFUNDED"].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {rows.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No payments yet.</p>}
          {rows.map((row) => (
            <Link key={row.id} href={`/bookings/${row.bookingId}`} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex justify-between gap-3 hover:bg-slate-50">
              <div>
                <p className="font-black uppercase tracking-tight">{row.bookingRef}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{row.status} · {row.method || "—"} · {row.providerRef || "no ref"}</p>
              </div>
              <p className="font-black">{row.currency} {row.amount.toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
