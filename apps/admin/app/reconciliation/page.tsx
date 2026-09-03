"use client";

import { AdminShell } from "../components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Issue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  bookingId: string;
  bookingRef: string;
  paymentId?: string;
  invoiceId?: string;
};

type Report = {
  generatedAt: string;
  scanned: { payments: number; bookings: number; invoices: number };
  errors: number;
  warnings: number;
  balanced: boolean;
  issues: Issue[];
};

export default function ReconciliationPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/reconciliation");
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to reconcile");
    else {
      setError("");
      setReport(data);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Reconciliation</h1>
            <p className="text-sm font-bold text-slate-500 mt-2">Payments vs ledger vs invoices for captured and refunded bookings.</p>
          </div>
          <button onClick={() => void load()} className="px-6 py-3 rounded-2xl bg-ink text-white text-[10px] font-black uppercase tracking-widest hover:bg-gold">
            Refresh
          </button>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="text-2xl font-black mt-2">{report.balanced ? "Balanced" : "Exceptions"}</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Errors</p>
                <p className="text-2xl font-black mt-2">{report.errors}</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Warnings</p>
                <p className="text-2xl font-black mt-2">{report.warnings}</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scanned</p>
                <p className="text-2xl font-black mt-2">{report.scanned.payments + report.scanned.bookings}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
              {report.issues.length === 0 && <p className="p-8 text-sm font-bold text-slate-400">No mismatches on the latest captured payments, refunds, or invoices.</p>}
              {report.issues.map((row, index) => (
                <Link
                  key={`${row.code}-${row.bookingId}-${index}`}
                  href={`/bookings/${row.bookingId}`}
                  className="px-8 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-black uppercase tracking-tight">{row.bookingRef}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                      {row.severity} · {row.code}
                    </p>
                    <p className="text-sm font-bold text-slate-500 mt-2">{row.message}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </AdminShell>
  );
}
