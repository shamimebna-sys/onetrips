"use client";

import { AdminShell } from "../../components/AdminShell";
import { useEffect, useMemo, useState } from "react";

type City = { id: string; name: string; country: { name: string; code: string } };
type Airport = {
  id: string;
  iataCode: string;
  name: string;
  timezone: string;
  isActive: boolean;
  isPopular: boolean;
  city: City;
};

export default function AirportsPage() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    iataCode: "",
    name: "",
    cityId: "",
    timezone: "Asia/Dhaka",
    isPopular: false,
  });

  const load = async () => {
    const [airportRes, cityRes] = await Promise.all([
      fetch("/api/catalog/airports"),
      fetch("/api/catalog/cities"),
    ]);
    if (airportRes.ok) setAirports((await airportRes.json()).airports);
    if (cityRes.ok) setCities((await cityRes.json()).cities);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airports;
    return airports.filter(
      (airport) =>
        airport.iataCode.toLowerCase().includes(q) ||
        airport.name.toLowerCase().includes(q) ||
        airport.city.name.toLowerCase().includes(q),
    );
  }, [airports, query]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/catalog/airports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create airport");
      return;
    }
    setForm({ iataCode: "", name: "", cityId: "", timezone: "Asia/Dhaka", isPopular: false });
    await load();
  };

  const toggle = async (airport: Airport, field: "isActive" | "isPopular") => {
    await fetch(`/api/catalog/airports/${airport.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !airport[field] }),
    });
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Airports</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-4">{error}</div>}

        <form onSubmit={create} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <input required maxLength={3} placeholder="IATA" className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" value={form.iataCode} onChange={(e) => setForm({ ...form, iataCode: e.target.value })} />
          <input required placeholder="Airport name" className="md:col-span-2 bg-muted p-4 rounded-2xl font-bold outline-none" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select required className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
            <option value="">City</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>{city.name}, {city.country.code}</option>
            ))}
          </select>
          <input required placeholder="Timezone" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add</button>
        </form>

        <input
          placeholder="Search IATA, name, city"
          className="w-full bg-white border border-slate-100 p-4 rounded-2xl font-bold mb-6 outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4">IATA</th>
                <th className="p-4">Airport</th>
                <th className="p-4">City</th>
                <th className="p-4">Status</th>
                <th className="p-4">Popular</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((airport) => (
                <tr key={airport.id} className="border-t border-slate-50 text-sm font-bold">
                  <td className="p-4 text-gold">{airport.iataCode}</td>
                  <td className="p-4">{airport.name}</td>
                  <td className="p-4 text-slate-500">{airport.city.name}, {airport.city.country.code}</td>
                  <td className="p-4">
                    <button onClick={() => toggle(airport, "isActive")} className={`text-[10px] uppercase tracking-widest ${airport.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                      {airport.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggle(airport, "isPopular")} className={`text-[10px] uppercase tracking-widest ${airport.isPopular ? "text-gold" : "text-slate-400"}`}>
                      {airport.isPopular ? "Yes" : "No"}
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
