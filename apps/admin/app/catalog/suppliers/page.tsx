"use client";

import { AdminShell } from "../../components/AdminShell";
import { useEffect, useState } from "react";

type Supplier = {
  id: string;
  name: string;
  type: string;
  status: string;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", type: "GDS" });

  const load = async () => {
    const res = await fetch("/api/catalog/suppliers");
    if (res.ok) setSuppliers((await res.json()).suppliers);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/catalog/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Unable to create supplier");
      return;
    }
    setForm({ name: "", type: "GDS" });
    await load();
  };

  const toggle = async (supplier: Supplier) => {
    const next = supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await fetch(`/api/catalog/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Suppliers</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase mb-4">{error}</div>}
        <form onSubmit={create} className="bg-white rounded-[2rem] border border-slate-100 p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input required placeholder="Supplier name" className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="bg-muted p-4 rounded-2xl font-bold outline-none" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {["GDS", "AIRLINE", "HOTEL", "PAYMENT", "SMS", "EMAIL"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button className="bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gold">Add</button>
        </form>
        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="px-5 py-4 border-b border-slate-50 flex justify-between items-center font-bold text-sm">
              <div>
                <p>{supplier.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">{supplier.type}</p>
              </div>
              <button onClick={() => toggle(supplier)} className={`text-[10px] uppercase tracking-widest ${supplier.status === "ACTIVE" ? "text-emerald-600" : "text-slate-400"}`}>
                {supplier.status}
              </button>
            </div>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
