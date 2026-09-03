"use client";

import { AdminShell } from "../../components/AdminShell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Booking = {
  id: string;
  bookingRef: string;
  status: string;
  totalAmount: number;
  currency: string;
  providerRef: string | null;
  createdAt: string;
  owner: { email: string | null; displayName: string | null; phone: string | null } | null;
  organization: { name: string } | null;
  next: { canIssueTickets?: boolean; canCancel?: boolean; canRefund?: boolean; canResolveProvider?: boolean };
  segments: Array<{ origin: string; destination: string; departureAt: string; airlineCode: string; flightNumber: string }>;
  passengers: Array<{ id: string; firstName: string; lastName: string; type: string; ticketNumber?: string | null }>;
  payments: Array<{ id: string; status: string; amount: number; currency: string; method: string | null }>;
  tickets: Array<{ id: string; ticketNumber: string; status: string }>;
  invoices: Array<{ id: string; invoiceNo: string; status: string; total: number }>;
  history: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; at: string }>;
};

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");

  const load = async () => {
    const res = await fetch(`/api/bookings/${params.id}`);
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load booking");
    else setBooking(data.booking);
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const issue = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/tickets`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Ticketing failed");
    await load();
    setBusy(false);
  };

  const cancel = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Admin cancellation" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Cancel failed");
    await load();
    setBusy(false);
  };

  const resolveProvider = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/bookings/${params.id}/resolve`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Resolve failed");
    await load();
    setBusy(false);
  };

  const refund = async () => {
    setBusy(true);
    setError("");
    const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
    const res = await fetch(`/api/bookings/${params.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Admin refund", amount }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Refund failed");
    await load();
    setBusy(false);
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-5xl space-y-6">
        <Link href="/bookings" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to bookings</Link>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        {!booking && !error && <p className="font-bold text-slate-400">Loading…</p>}
        {booking && (
          <>
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">{booking.status}</p>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mt-2">{booking.bookingRef}</h1>
                <p className="text-sm font-bold text-slate-500 mt-2">
                  {booking.owner?.email || "No owner"} · PNR {booking.providerRef || "—"} · {booking.currency} {booking.totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {booking.next.canIssueTickets && (
                  <button onClick={() => void issue()} disabled={busy} className="px-6 py-3 rounded-2xl bg-ink text-white text-[10px] font-black uppercase tracking-widest hover:bg-gold">
                    {busy ? "Working…" : "Issue tickets"}
                  </button>
                )}
                {booking.next.canResolveProvider && (
                  <button onClick={() => void resolveProvider()} disabled={busy} className="px-6 py-3 rounded-2xl bg-gold text-ink text-[10px] font-black uppercase tracking-widest">
                    Resolve with supplier
                  </button>
                )}
                {booking.next.canCancel && (
                  <button onClick={() => void cancel()} disabled={busy} className="px-6 py-3 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:border-gold">
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <section className="bg-white border border-slate-100 rounded-[2rem] p-8">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Itinerary</h2>
              {booking.segments.map((leg, index) => (
                <p key={index} className="font-bold text-sm">
                  {leg.airlineCode} {leg.flightNumber} · {leg.origin} → {leg.destination} · {new Date(leg.departureAt).toLocaleString()}
                </p>
              ))}
            </section>
            <section className="bg-white border border-slate-100 rounded-[2rem] p-8">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Travelers</h2>
              {booking.passengers.map((row) => (
                <p key={row.id} className="font-bold text-sm">{row.firstName} {row.lastName} · {row.type} · {row.ticketNumber || "No ticket"}</p>
              ))}
            </section>
            <section className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payments</h2>
              {booking.payments.length === 0 && <p className="text-sm font-bold text-slate-400">No payments.</p>}
              {booking.payments.map((payment) => (
                <p key={payment.id} className="font-bold text-sm">
                  {payment.status} · {payment.currency} {payment.amount.toLocaleString()} · {payment.method || "—"}
                </p>
              ))}
              {booking.next.canRefund && (
                <div className="flex flex-col md:flex-row gap-3 pt-2">
                  <input
                    className="flex-1 border border-slate-100 rounded-2xl p-4 font-bold outline-none"
                    placeholder="Refund amount (blank = remaining)"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                  <button onClick={() => void refund()} disabled={busy} className="px-6 py-3 rounded-2xl bg-ink text-white text-[10px] font-black uppercase tracking-widest hover:bg-gold">
                    {busy ? "Refunding…" : "Refund"}
                  </button>
                </div>
              )}
            </section>
            <section className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tickets & invoices</h2>
              {booking.tickets.map((ticket) => (
                <a key={ticket.id} href={`/api/bookings/${booking.id}/tickets/${ticket.ticketNumber}/pdf`} className="block font-black uppercase text-sm hover:text-gold">
                  Ticket {ticket.ticketNumber}
                </a>
              ))}
              {booking.invoices.map((invoice) => (
                <a key={invoice.id} href={`/api/invoices/${invoice.id}/pdf`} className="block font-black uppercase text-sm hover:text-gold">
                  Invoice {invoice.invoiceNo} · {invoice.status}
                </a>
              ))}
            </section>
            <section className="bg-white border border-slate-100 rounded-[2rem] p-8">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">History</h2>
              {booking.history.map((row, index) => (
                <p key={index} className="text-sm font-bold text-slate-500">
                  {row.toStatus} · {row.reason || "—"} · {new Date(row.at).toLocaleString()}
                </p>
              ))}
            </section>
          </>
        )}
      </main>
    </AdminShell>
  );
}
