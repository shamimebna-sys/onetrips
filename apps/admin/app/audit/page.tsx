"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorEmail: string | null;
  reason: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = async (query = q) => {
    const res = await fetch(`/api/audit?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load audit log");
    else {
      setError("");
      setRows(data.logs ?? []);
    }
  };

  useEffect(() => {
    void load("");
  }, []);

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Platform</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-6">Audit log</h1>
        <form className="flex gap-3 mb-6" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <input className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none" placeholder="Action, entity, actor" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="px-6 bg-ink text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">Search</button>
        </form>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {rows.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No audit events yet.</p>}
          {rows.map((row) => (
            <div key={row.id} className="px-6 py-4 border-t border-slate-50 first:border-t-0">
              <p className="font-black uppercase tracking-tight">{row.action}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                {row.entityType} {row.entityId.slice(0, 12)} · {row.actorEmail || row.actorType} · {new Date(row.createdAt).toLocaleString()} · {row.reason || "—"}
              </p>
            </div>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
