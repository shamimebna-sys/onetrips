"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Markup = {
  id: string;
  appliesTo: string;
  markupType: string;
  markupValue: number;
  airlineCode: string | null;
  routeOrigin: string | null;
  routeDest: string | null;
  cabin: string | null;
  priority: number;
  status: string;
};

type Fee = {
  id: string;
  name: string;
  amount: number;
  type: string;
  appliesTo: string;
  status: string;
};

const emptyMarkup = {
  appliesTo: "B2C",
  markupType: "PERCENT",
  markupValue: "5",
  airlineCode: "",
  routeOrigin: "",
  routeDest: "",
  cabin: "",
  priority: "0",
};

const emptyFee = { name: "", amount: "300", type: "FLAT", appliesTo: "B2C" };

export default function PricingPage() {
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [error, setError] = useState("");
  const [markupForm, setMarkupForm] = useState(emptyMarkup);
  const [feeForm, setFeeForm] = useState(emptyFee);

  const load = async () => {
    const [markupRes, feeRes] = await Promise.all([fetch("/api/pricing/markups"), fetch("/api/pricing/fees")]);
    const markupData = await markupRes.json();
    const feeData = await feeRes.json();
    if (!markupRes.ok) setError(markupData.message || "Unable to load markup rules");
    else setMarkups(markupData.rules ?? []);
    if (!feeRes.ok) setError(feeData.message || "Unable to load service fees");
    else setFees(feeData.rules ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const createMarkup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/pricing/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...markupForm,
        markupValue: Number(markupForm.markupValue),
        priority: Number(markupForm.priority),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create markup rule");
      return;
    }
    setMarkupForm(emptyMarkup);
    await load();
  };

  const createFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/pricing/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...feeForm, amount: Number(feeForm.amount) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create service fee");
      return;
    }
    setFeeForm(emptyFee);
    await load();
  };

  const toggleMarkup = async (rule: Markup) => {
    await fetch(`/api/pricing/markups/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    });
    await load();
  };

  const toggleFee = async (rule: Fee) => {
    await fetch(`/api/pricing/fees/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    });
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl space-y-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-ink">Pricing rules</h1>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase">{error}</div>}

        <section>
          <h2 className="text-lg font-black uppercase tracking-tighter mb-4">Markup</h2>
          <form onSubmit={createMarkup} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <select className="bg-muted p-4 rounded-2xl font-bold outline-none" value={markupForm.appliesTo} onChange={(e) => setMarkupForm({ ...markupForm, appliesTo: e.target.value })}>
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
            <select className="bg-muted p-4 rounded-2xl font-bold outline-none" value={markupForm.markupType} onChange={(e) => setMarkupForm({ ...markupForm, markupType: e.target.value })}>
              <option value="PERCENT">Percent</option>
              <option value="FLAT">Flat</option>
            </select>
            <input required className="bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Value" value={markupForm.markupValue} onChange={(e) => setMarkupForm({ ...markupForm, markupValue: e.target.value })} />
            <input className="bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Priority" value={markupForm.priority} onChange={(e) => setMarkupForm({ ...markupForm, priority: e.target.value })} />
            <input maxLength={2} className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" placeholder="Airline" value={markupForm.airlineCode} onChange={(e) => setMarkupForm({ ...markupForm, airlineCode: e.target.value })} />
            <input maxLength={3} className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" placeholder="Origin" value={markupForm.routeOrigin} onChange={(e) => setMarkupForm({ ...markupForm, routeOrigin: e.target.value })} />
            <input maxLength={3} className="bg-muted p-4 rounded-2xl font-black uppercase outline-none" placeholder="Dest" value={markupForm.routeDest} onChange={(e) => setMarkupForm({ ...markupForm, routeDest: e.target.value })} />
            <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add markup</button>
          </form>
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
            {markups.length === 0 && <p className="p-8 text-sm font-bold text-slate-400">No markup rules yet.</p>}
            {markups.map((rule) => (
              <div key={rule.id} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-black uppercase tracking-tight">
                    {rule.appliesTo} · {rule.markupType === "PERCENT" ? `${rule.markupValue}%` : `৳ ${rule.markupValue}`}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {rule.airlineCode || "Any airline"} · {rule.routeOrigin || "XXX"}–{rule.routeDest || "XXX"} · priority {rule.priority} · {rule.status}
                  </p>
                </div>
                <button onClick={() => void toggleMarkup(rule)} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 text-slate-500 hover:bg-slate-50">
                  {rule.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black uppercase tracking-tighter mb-4">Service fees</h2>
          <form onSubmit={createFee} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input required className="bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Name" value={feeForm.name} onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })} />
            <input required className="bg-muted p-4 rounded-2xl font-bold outline-none" placeholder="Amount" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} />
            <select className="bg-muted p-4 rounded-2xl font-bold outline-none" value={feeForm.type} onChange={(e) => setFeeForm({ ...feeForm, type: e.target.value })}>
              <option value="FLAT">Flat</option>
              <option value="PERCENT">Percent</option>
            </select>
            <div className="flex gap-3">
              <select className="flex-1 bg-muted p-4 rounded-2xl font-bold outline-none" value={feeForm.appliesTo} onChange={(e) => setFeeForm({ ...feeForm, appliesTo: e.target.value })}>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
              <button className="px-5 bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add</button>
            </div>
          </form>
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
            {fees.length === 0 && <p className="p-8 text-sm font-bold text-slate-400">No service fees yet.</p>}
            {fees.map((rule) => (
              <div key={rule.id} className="px-6 py-4 border-t border-slate-50 first:border-t-0 flex items-center justify-between gap-3">
                <div>
                  <p className="font-black uppercase tracking-tight">{rule.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {rule.appliesTo} · {rule.type === "PERCENT" ? `${rule.amount}%` : `৳ ${rule.amount}`} · {rule.status}
                  </p>
                </div>
                <button onClick={() => void toggleFee(rule)} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 text-slate-500 hover:bg-slate-50">
                  {rule.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
