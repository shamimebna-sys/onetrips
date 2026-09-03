"use client";

import { AgencyShell } from "./components/AgencyShell";
import { useEffect, useState } from "react";

type Workspace = {
  organization: { name: string; status: string; type: string; city: string | null; country: string | null; role: string };
  wallet: { balance: number; creditLimit: number; available: number; currency: string; status: string };
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString()}`;
}

export default function AgencyHomePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspace")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Unable to load workspace");
        setWorkspace(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <AgencyShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Workspace</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">
          {workspace?.organization.name ?? "Agency"}
        </h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {workspace && (
          <>
            <p className="text-sm font-medium text-slate-500 mb-8">
              {workspace.organization.type} · {workspace.organization.status} · {workspace.organization.role}
              {workspace.organization.city ? ` · ${workspace.organization.city}` : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: "Wallet balance", value: money(workspace.wallet.currency, workspace.wallet.balance), gold: false },
                { label: "Credit limit", value: money(workspace.wallet.currency, workspace.wallet.creditLimit), gold: false },
                { label: "Available to book", value: money(workspace.wallet.currency, workspace.wallet.available), gold: true },
              ].map((card) => (
                <div key={card.label} className={`bg-white border rounded-[2rem] p-8 ${card.gold ? "border-[#d4af37]/40" : "border-slate-100"}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                  <p className={`text-2xl font-black mt-3 ${card.gold ? "text-[#d4af37]" : "text-ink"}`}>{card.value}</p>
                </div>
              ))}
            </div>
            {workspace.organization.status !== "ACTIVE" && (
              <p className="mt-8 text-sm font-medium text-amber-600">
                This agency is {workspace.organization.status.toLowerCase()}. Spending is blocked until operations activate the account.
              </p>
            )}
            <div className="mt-10 flex gap-4">
              <a href="/search" className="bg-ink text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">Search flights</a>
              <a href="/bookings" className="border border-slate-200 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest">View bookings</a>
            </div>
          </>
        )}
      </main>
    </AgencyShell>
  );
}
