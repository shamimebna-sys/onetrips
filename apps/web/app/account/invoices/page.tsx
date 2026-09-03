"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, SkeletonBlock } from "@onetrips/ui";

type Row = {
  id: string;
  invoiceNo: string;
  bookingId: string | null;
  bookingRef?: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
};

export default function InvoicesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/account/invoices")
      .then((res) => (res.ok ? res.json() : { invoices: [] }))
      .then((data) => setRows(data.invoices ?? []));
  }, []);

  if (rows === null) return <SkeletonBlock rows={3} />;
  if (!rows.length) {
    return (
      <EmptyState
        title="No invoices yet"
        description="Invoices generated from your bookings will appear here."
        action={
          <Link href="/account/trips" className="inline-flex rounded-xl bg-ink px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">
            View trips
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
      <h1 className="p-8 text-3xl font-black tracking-tight text-ink">Invoices</h1>
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col justify-between gap-3 border-t border-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="font-black uppercase">{row.invoiceNo}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {row.bookingRef || "Booking"} · {row.status}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-black">
              {row.currency} {row.amount.toLocaleString()}
            </p>
            {row.pdfUrl ? (
              <a href={row.pdfUrl} className="text-[10px] font-black uppercase tracking-widest text-gold-dark">
                Download PDF
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
