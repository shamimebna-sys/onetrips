"use client";

import { AdminShell } from "../components/AdminShell";
import { useEffect, useState } from "react";

type Org = {
  id: string;
  name: string;
  status: string;
  type: string;
  memberCount: number;
  wallet: { balance: number; creditLimit: number; available: number; currency: string };
};

export default function AgenciesPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState("");
  const [credit, setCredit] = useState<Record<string, string>>({});
  const [deposit, setDeposit] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch("/api/agencies");
    const data = await res.json();
    if (!res.ok) setError(data.message || "Unable to load agencies");
    else setOrgs(data.organizations ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (id: string, body: object) => {
    setError("");
    const res = await fetch(`/api/agencies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Update failed");
    await load();
  };

  return (
    <AdminShell>
      <main className="p-8 max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">B2B</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Agencies</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        <div className="space-y-4">
          {orgs.map((org) => (
            <div key={org.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-black uppercase tracking-tight">{org.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {org.type} · {org.status} · {org.memberCount} members · available {org.wallet.currency} {org.wallet.available.toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(["ACTIVE", "SUSPENDED", "REJECTED"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => patch(org.id, { status })}
                      className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 text-slate-500 hover:bg-slate-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void patch(org.id, { creditLimit: Number(credit[org.id] ?? org.wallet.creditLimit) });
                  }}
                >
                  <input
                    className="flex-1 bg-muted p-3 rounded-xl font-bold outline-none"
                    placeholder="Credit limit"
                    value={credit[org.id] ?? String(org.wallet.creditLimit)}
                    onChange={(e) => setCredit({ ...credit, [org.id]: e.target.value })}
                  />
                  <button className="px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-ink text-white">Limit</button>
                </form>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void patch(org.id, { deposit: Number(deposit[org.id] || "0") });
                  }}
                >
                  <input
                    className="flex-1 bg-muted p-3 rounded-xl font-bold outline-none"
                    placeholder="Deposit amount"
                    value={deposit[org.id] ?? ""}
                    onChange={(e) => setDeposit({ ...deposit, [org.id]: e.target.value })}
                  />
                  <button className="px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-ink text-white">Deposit</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
