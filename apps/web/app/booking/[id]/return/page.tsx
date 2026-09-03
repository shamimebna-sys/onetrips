"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ReturnInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentId = search.get("paymentId");
    if (!paymentId) {
      router.replace(`/booking/${params.id}`);
      return;
    }
    fetch(`/api/bookings/${params.id}/pay/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Could not confirm payment");
          return;
        }
        router.replace(`/booking/${params.id}`);
      })
      .catch(() => setError("Could not confirm payment"));
  }, [params.id, router, search]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase mb-6">{error}</p>
        <Link href={`/booking/${params.id}`} className="text-[10px] font-black uppercase tracking-widest text-[#996515]">
          Back to booking
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin mx-auto mb-6" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirming payment</p>
      </div>
    </main>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      }
    >
      <ReturnInner />
    </Suspense>
  );
}
