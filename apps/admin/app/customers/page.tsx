"use client";

import { AdminShell } from "../components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  status: string;
  bookingCount: number;
  createdAt: string;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = async (query = q) => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load customers");
    else {
      setError("");
      setRows(data.customers ?? []);
    }
  };

  useEffect(() => {
    void load("");
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Operations</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Customers</h1>
        <form className="flex gap-3 mb-6" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <input className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none" placeholder="Email, phone, name" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="px-6 bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">Search</button>
        </form>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {rows.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No customers yet.</p>}
          {rows.map((row) => (
            <Link key={row.id} href={`/customers/${row.id}`} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex justify-between gap-3 hover:bg-slate-50">
              <div>
                <p className="font-black uppercase tracking-tight">{row.displayName || row.email || "Customer"}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{row.email} · {row.phone || "No phone"} · {row.status}</p>
              </div>
              <p className="font-black text-sm">{row.bookingCount} bookings</p>
            </Link>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
