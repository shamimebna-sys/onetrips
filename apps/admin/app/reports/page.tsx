"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Report = {
  monthStart: string;
  bookingsThisMonth: number;
  capturedThisMonth: number;
  capturedThisMonthCount: number;
  invoices: { count: number; total: number };
  bookingsByStatus: Array<{ status: string; count: number }>;
  paymentsByStatus: Array<{ status: string; count: number; amount: number }>;
};

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ops/report")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setError(data.message || "Unable to load report");
        else setReport(data);
      });
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Commercial</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Reports</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bookings this month</p>
            <p className="text-3xl font-black mt-3">{report?.bookingsThisMonth ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Captured this month</p>
            <p className="text-3xl font-black mt-3">BDT {report ? report.capturedThisMonth.toLocaleString() : "—"}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoices</p>
            <p className="text-3xl font-black mt-3">{report?.invoices.count ?? "—"}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Bookings by status</h2>
            {(report?.bookingsByStatus ?? []).map((row) => (
              <div key={row.status} className="flex justify-between py-2 border-t border-slate-50 first:border-t-0 font-bold text-sm">
                <span>{row.status}</span><span>{row.count}</span>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Payments by status</h2>
            {(report?.paymentsByStatus ?? []).map((row) => (
              <div key={row.status} className="flex justify-between py-2 border-t border-slate-50 first:border-t-0 font-bold text-sm">
                <span>{row.status}</span><span>{row.count} · {row.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
