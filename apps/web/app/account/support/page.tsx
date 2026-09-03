"use client";

import { useEffect, useState } from "react";
import { Alert, Button, EmptyState, Input, Select } from "@onetrips/ui";

type Message = { id: string; actorType: string; body: string; createdAt: string };
type RequestRow = {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  bookingId?: string | null;
  messages?: Message[];
};

export default function AccountSupportPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ category: "other", subject: "", message: "", bookingId: "" });

  const load = () =>
    fetch("/api/account/support")
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => setRows(data.requests ?? []));

  useEffect(() => {
    load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/account/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, bookingId: form.bookingId || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to send request.");
      return;
    }
    setMessage("Request sent.");
    setForm({ category: "other", subject: "", message: "", bookingId: "" });
    load();
  };

  const selected = rows.find((row) => row.id === openId);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-ink">Support</h1>
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-slate-100 bg-white p-8">
        <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="ticket">Ticket issue</option>
          <option value="hotel">Hotel issue</option>
          <option value="cancellation">Cancellation</option>
          <option value="refund">Refund</option>
          <option value="other">Other</option>
        </Select>
        <Input label="Subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <Input label="Booking ID (optional)" value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })} />
        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message</span>
          <textarea
            required
            minLength={8}
            className="w-full rounded-2xl bg-muted p-4 font-bold outline-none focus:ring-2 ring-gold"
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </label>
        <Button type="submit">Send request</Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Send a message about a booking and we will keep the conversation here."
        />
      ) : null}
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => setOpenId(row.id === openId ? null : row.id)}
          className="block w-full rounded-[2rem] border border-slate-100 bg-white p-6 text-left"
        >
          <p className="font-black uppercase">{row.subject}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {row.category} · {row.status}
            {row.bookingId ? ` · Booking ${row.bookingId.slice(0, 8)}` : ""}
          </p>
        </button>
      ))}
      {selected ? (
        <section className="space-y-3 rounded-[2rem] border border-slate-100 bg-white p-6" data-testid="support-thread">
          <h2 className="text-lg font-black uppercase tracking-tighter">Conversation</h2>
          {(selected.messages ?? []).map((item) => (
            <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {item.actorType === "CUSTOMER" ? "You" : "Support"} · {new Date(item.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">{item.body}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
