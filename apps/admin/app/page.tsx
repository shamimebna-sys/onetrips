"use client";

import { AdminShell } from "./components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard = {
  currency: string;
  revenueCaptured: number;
  customers: number;
  invoices: number;
  bookings: {
    total: number;
    today: number;
    ticketed: number;
    ticketingFailed: number;
    paymentPending: number;
    confirmed: number;
    refundPending: number;
    cancelled: number;
  };
  agencies: { pending: number; active: number };
  catalog: { airports: number; airlines: number; countries: number; suppliers: number };
};

export default function AdminHomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ops/dashboard")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) setError(json.message || "Unable to load dashboard");
        else setData(json);
      });
  }, []);

  const cards = data
    ? [
        { label: "Bookings today", value: data.bookings.today, href: "/bookings" },
        { label: "Ticketed", value: data.bookings.ticketed, href: "/bookings?status=TICKETED" },
        { label: "Awaiting pay", value: data.bookings.paymentPending, href: "/bookings?status=PAYMENT_PENDING" },
        { label: "Ticketing failed", value: data.bookings.ticketingFailed, href: "/bookings?status=TICKETING_FAILED" },
        { label: "Refund pending", value: data.bookings.refundPending, href: "/bookings?status=REFUND_PENDING" },
        { label: "Cancelled", value: data.bookings.cancelled, href: "/bookings?status=CANCELLED" },
        { label: "Captured", value: `${data.currency} ${data.revenueCaptured.toLocaleString()}`, href: "/payments" },
        { label: "Customers", value: data.customers, href: "/customers" },
        { label: "Agencies pending", value: data.agencies.pending, href: "/agencies" },
        { label: "Invoices", value: data.invoices, href: "/invoices" },
      ]
    : [];

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Operations</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Dashboard</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white border border-slate-100 rounded-[2rem] p-6 hover:-translate-y-1 transition-all shadow-[0_20px_50px_rgba(15,23,42,0.03)]"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className="text-3xl font-black text-ink mt-3">{data ? card.value : "—"}</p>
            </Link>
          ))}
        </div>
        <div className="bg-white border border-slate-100 rounded-[2rem] p-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Catalog</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Link href="/catalog/airports" className="font-black uppercase tracking-tight">Airports <span className="text-gold">{data?.catalog.airports ?? "—"}</span></Link>
            <Link href="/catalog/airlines" className="font-black uppercase tracking-tight">Airlines <span className="text-gold">{data?.catalog.airlines ?? "—"}</span></Link>
            <Link href="/catalog/countries" className="font-black uppercase tracking-tight">Countries <span className="text-gold">{data?.catalog.countries ?? "—"}</span></Link>
            <Link href="/catalog/suppliers" className="font-black uppercase tracking-tight">Suppliers <span className="text-gold">{data?.catalog.suppliers ?? "—"}</span></Link>
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
