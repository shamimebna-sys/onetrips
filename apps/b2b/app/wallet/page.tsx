"use client";

import { AgencyShell } from "../components/AgencyShell";
import { useEffect, useState } from "react";

type Wallet = { balance: number; creditLimit: number; available: number; currency: string; status: string };

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("10000");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/wallet")
      .then(async (res) => {
        const data = await res.json();
        if (ignore) return;
        if (!res.ok) setError(data.message || "Unable to load wallet");
        else setWallet(data.wallet);
      })
      .catch(() => {
        if (!ignore) setError("Unable to load wallet");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const deposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), note: "Sandbox top-up" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "Deposit failed");
    else setWallet(data.wallet);
    setSaving(false);
  };

  return (
    <AgencyShell>
      <main className="p-8 max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Wallet</h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</div>}
        {wallet && (
          <div className="bg-white border border-slate-100 rounded-[2rem] p-8 mb-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance</p>
            <p className="text-3xl font-black text-[#d4af37] mt-2">{wallet.currency} {wallet.balance.toLocaleString()}</p>
            <p className="text-sm font-medium text-slate-500 mt-3">
              Available {wallet.currency} {wallet.available.toLocaleString()} · wallet {wallet.status.toLowerCase()}
            </p>
          </div>
        )}
        <form onSubmit={deposit} className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tighter">Sandbox top-up</h2>
          <p className="text-sm text-slate-500">Records a DEPOSIT ledger line. Live bank deposits ship with finance ops later.</p>
          <input className="w-full bg-muted p-4 rounded-2xl font-bold outline-none" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button disabled={saving} className="w-full bg-ink text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-gold">
            {saving ? "Posting..." : "Deposit"}
          </button>
        </form>
      </main>
    </AgencyShell>
  );
}
