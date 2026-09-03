"use client";

import { AgencyShell } from "../../components/AgencyShell";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function StartInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const sessionId = params.get("sid");
    const offerId = params.get("offer");
    if (!sessionId || !offerId) {
      setError("Missing fare selection.");
      return;
    }
    fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, offerId, ...(params.get("product") === "HOTEL" ? { product: "HOTEL" } : {}) }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Unable to start booking");
          return;
        }
        router.replace(`/booking/${data.booking.id}`);
      })
      .catch(() => setError("Unable to start booking"));
  }, [params, router]);

  return (
    <AgencyShell>
      <main className="p-8 max-w-xl">
        {error ? (
          <div>
            <p className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</p>
            <Link href="/search" className="text-[10px] font-black uppercase tracking-widest text-[#996515]">Back to search</Link>
          </div>
        ) : (
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirming B2B fare…</p>
        )}
      </main>
    </AgencyShell>
  );
}

export default function AgencyBookingStartPage() {
  return (
    <Suspense fallback={<AgencyShell><main className="p-8">Confirming fare…</main></AgencyShell>}>
      <StartInner />
    </Suspense>
  );
}
