"use client";

import { AgencyShell } from "../components/AgencyShell";
import { useEffect, useState } from "react";

type Entry = { id: string; type: string; amount: number; currency: string; reference: string; note: string | null; createdAt: string };

export default function LedgerPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ledger")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setError(data.message || "Unable to load ledger");
        else setEntries(data.entries ?? []);
      });
  }, []);

  return (
    <AgencyShell>
      <main className="p-8 max-w-5xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Ledger</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
          {entries.length === 0 && !error && <p className="p-8 text-sm font-bold text-slate-400">No ledger lines yet.</p>}
          {entries.map((row) => (
            <div key={row.id} className="px-8 py-4 border-t border-slate-50 first:border-t-0 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <p className="font-black uppercase tracking-tight">{row.type}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{row.reference} · {row.note || "—"}</p>
              </div>
              <p className="font-black">{row.currency} {row.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </main>
    </AgencyShell>
  );
}
