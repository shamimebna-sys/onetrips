"use client";

import { AdminShell } from "../../components/AdminShell";
import { useEffect, useState } from "react";

type Country = { id: string; code: string; name: string; _count?: { cities: number } };
type City = { id: string; name: string; code: string | null; countryId: string; country: { code: string } };

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [error, setError] = useState("");
  const [countryForm, setCountryForm] = useState({ code: "", name: "" });
  const [cityForm, setCityForm] = useState({ countryId: "", name: "", code: "" });

  const load = async () => {
    const [countryRes, cityRes] = await Promise.all([
      fetch("/api/catalog/countries"),
      fetch("/api/catalog/cities"),
    ]);
    if (countryRes.ok) setCountries((await countryRes.json()).countries);
    if (cityRes.ok) setCities((await cityRes.json()).cities);
  };

  useEffect(() => {
    load();
  }, []);

  const addCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/catalog/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(countryForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create country");
      return;
    }
    setCountryForm({ code: "", name: "" });
    await load();
  };

  const addCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/catalog/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cityForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create city");
      return;
    }
    setCityForm({ countryId: "", name: "", code: "" });
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Countries & Cities</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-4">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <form onSubmit={addCountry} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-6 grid grid-cols-3 gap-3">
              <input required maxLength={2} placeholder="Code" className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value })} />
              <input required placeholder="Country" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} />
              <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add</button>
            </form>
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
              {countries.map((country) => (
                <div key={country.id} className="px-5 py-4 border-b border-slate-50 flex justify-between font-bold text-sm">
                  <span><span className="text-gold mr-3">{country.code}</span>{country.name}</span>
                  <span className="text-slate-400 text-xs">{country._count?.cities ?? 0} cities</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <form onSubmit={addCity} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-6 grid grid-cols-2 gap-3">
              <select required className="bg-muted p-4 rounded-2xl font-bold outline-none col-span-2" value={cityForm.countryId} onChange={(e) => setCityForm({ ...cityForm, countryId: e.target.value })}>
                <option value="">Country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>{country.name}</option>
                ))}
              </select>
              <input required placeholder="City name" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })} />
              <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add city</button>
            </form>
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden max-h-[480px] overflow-y-auto">
              {cities.map((city) => (
                <div key={city.id} className="px-5 py-4 border-b border-slate-50 flex justify-between font-bold text-sm">
                  <span>{city.name}</span>
                  <span className="text-gold text-xs">{city.country.code}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </AdminShell>
  );
}
