"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, SkeletonBlock } from "@onetrips/ui";

type Row = {
  id: string;
  bookingId: string;
  bookingRef: string;
  amount: number;
  currency: string;
  method: string | null;
  status: string;
  createdAt: string;
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/account/payments")
      .then((res) => (res.ok ? res.json() : { payments: [] }))
      .then((data) => setRows(data.payments ?? []));
  }, []);

  if (rows === null) return <SkeletonBlock rows={3} />;
  if (!rows.length) {
    return (
      <EmptyState
        title="No payment history yet"
        description="Payments from your bookings will appear here."
        action={
          <Link href="/flights" className="inline-flex rounded-xl bg-ink px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">
            Explore Flights
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
      <h1 className="p-8 text-3xl font-black tracking-tight text-ink">Payments</h1>
      {rows.map((row) => (
        <Link key={row.id} href={`/booking/${row.bookingId}`} className="flex flex-col justify-between gap-2 border-t border-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="font-black uppercase">{row.bookingRef}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {row.method || "Gateway"} · {row.status} · {new Date(row.createdAt).toLocaleDateString()}
            </p>
          </div>
          <p className="font-black">
            {row.currency} {row.amount.toLocaleString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
