"use client";

import { AgencyShell } from "../components/AgencyShell";
import { useEffect, useState } from "react";

type Wallet = { balance: number; creditLimit: number; available: number; currency: string; organizationStatus: string };

export default function CreditPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    fetch("/api/wallet")
      .then((res) => (res.ok ? res.json() : { wallet: null }))
      .then((data) => setWallet(data.wallet));
  }, []);

  return (
    <AgencyShell>
      <main className="p-8 max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Finance</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-ink mb-8">Credit</h1>
        {wallet && (
          <div className="bg-white border border-slate-100 rounded-[2rem] p-8 space-y-6">
            <p className="text-sm font-medium text-slate-500">
              Available to book = wallet balance + credit limit (while the agency is active). Used credit is a negative wallet balance.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance</p>
                <p className="text-xl font-black mt-2">{wallet.currency} {wallet.balance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Credit limit</p>
                <p className="text-xl font-black mt-2">{wallet.currency} {wallet.creditLimit.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available</p>
                <p className="text-xl font-black mt-2 text-[#d4af37]">{wallet.currency} {wallet.available.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Agency {wallet.organizationStatus} · limit is set by ONETRIPS finance
            </p>
          </div>
        )}
      </main>
    </AgencyShell>
  );
}
