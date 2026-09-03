"use client";

import { AdminShell } from "../../components/AdminShell";
import { useEffect, useState } from "react";

type Airline = {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  isActive: boolean;
};

export default function AirlinesPage() {
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ iataCode: "", icaoCode: "", name: "" });

  const load = async () => {
    const res = await fetch("/api/catalog/airlines");
    if (res.ok) setAirlines((await res.json()).airlines);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/catalog/airlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create airline");
      return;
    }
    setForm({ iataCode: "", icaoCode: "", name: "" });
    await load();
  };

  const toggle = async (airline: Airline) => {
    await fetch(`/api/catalog/airlines/${airline.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !airline.isActive }),
    });
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Airlines</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-4">{error}</div>}
        <form onSubmit={create} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <input required maxLength={2} placeholder="IATA" className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" value={form.iataCode} onChange={(e) => setForm({ ...form, iataCode: e.target.value })} />
          <input maxLength={3} placeholder="ICAO" className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" value={form.icaoCode} onChange={(e) => setForm({ ...form, icaoCode: e.target.value })} />
          <input required placeholder="Airline name" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add</button>
        </form>
        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4">IATA</th>
                <th className="p-4">ICAO</th>
                <th className="p-4">Airline</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {airlines.map((airline) => (
                <tr key={airline.id} className="border-t border-slate-50 text-sm font-bold">
                  <td className="p-4 text-gold">{airline.iataCode}</td>
                  <td className="p-4 text-slate-500">{airline.icaoCode || "—"}</td>
                  <td className="p-4">{airline.name}</td>
                  <td className="p-4">
                    <button onClick={() => toggle(airline)} className={`text-[10px] uppercase tracking-widest ${airline.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                      {airline.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AdminShell>
  );
}
