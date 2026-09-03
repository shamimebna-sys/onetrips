"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Promo = { id: string; code: string; name: string; status: string; endsAt: string };

export default function PromotionsAdminPage() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    percentOff: "10",
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  });

  const load = () =>
    fetch("/api/promotions")
      .then((res) => res.json())
      .then((data) => setRows(data.promotions ?? []));

  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, percentOff: Number(form.percentOff) }),
    });
    load();
  };

  return (
    <AdminShell>
      <h1 className="mb-6 text-3xl font-black uppercase">Promotions</h1>
      <form onSubmit={create} className="mb-8 grid grid-cols-2 gap-3 rounded-3xl bg-white p-6">
        <input className="rounded-xl bg-slate-50 p-3 font-bold" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="rounded-xl bg-slate-50 p-3 font-bold" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-xl bg-slate-50 p-3 font-bold" placeholder="Percent" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value })} />
        <button className="rounded-xl bg-slate-900 text-white font-black uppercase text-xs">Create</button>
      </form>
      {rows.map((row) => (
        <div key={row.id} className="mb-2 flex justify-between rounded-2xl bg-white p-4">
          <span className="font-black">{row.code}</span>
          <span className="text-slate-500">{row.name} · {row.status}</span>
        </div>
      ))}
    </AdminShell>
  );
}
