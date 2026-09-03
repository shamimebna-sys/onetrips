"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  total: number;
  currency: string;
  bookingRef: string | null;
  organizationName: string | null;
  issuedAt: string | null;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/invoices")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setError(data.message || "Unable to load invoices");
        else setInvoices(data.invoices ?? []);
      });
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Invoices</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {invoices.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No invoices yet. They are issued when a booking is ticketed.</p>}
          {invoices.map((row) => (
            <div key={row.id} className="px-8 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="font-black uppercase tracking-tight">{row.invoiceNo}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {row.status} · {row.bookingRef || "No booking"} · {row.organizationName || "B2C"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-black">{row.currency} {row.total.toLocaleString()}</p>
                <a href={`/api/invoices/${row.id}/pdf`} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-ink text-white hover:bg-gold">
                  PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
