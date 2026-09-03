"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function SandboxInner() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const amount = params.get("amount") ?? "";
  const currency = params.get("currency") ?? "BDT";
  const booking = params.get("booking") ?? "";
  const returnUrl = params.get("return") ?? "/";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const finish = async (outcome: "SUCCESS" | "FAILED") => {
    setBusy(outcome);
    setError("");
    const res = await fetch("/api/payments/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerRef: ref, outcome }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Gateway error");
      setBusy(null);
      return;
    }
    window.location.href = returnUrl;
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-slate-100 p-10 space-y-6">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Mock payment gateway</p>
        <h1 className="text-3xl font-black uppercase tracking-tighter">ONETRIPS Pay</h1>
        <p className="text-sm font-medium text-slate-500">
          Booking {booking}. Charge {currency} {Number(amount).toLocaleString()}. This sandbox stands in for SSLCommerz / bKash until a live key is configured.
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-[10px] font-black uppercase">{error}</div>}
        <button
          disabled={Boolean(busy)}
          data-testid="pay-success"
          onClick={() => finish("SUCCESS")}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#d4af37]"
        >
          {busy === "SUCCESS" ? "Paying..." : "Pay successfully"}
        </button>
        <button
          disabled={Boolean(busy)}
          data-testid="pay-decline"
          onClick={() => finish("FAILED")}
          className="w-full border border-slate-100 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-red-500"
        >
          {busy === "FAILED" ? "Declining..." : "Simulate decline"}
        </button>
      </div>
    </main>
  );
}

export default function PaySandboxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      }
    >
      <SandboxInner />
    </Suspense>
  );
}
