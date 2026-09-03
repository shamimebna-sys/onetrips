"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorState, ensureCustomerSession } from "@onetrips/ui";
import { isSafeReturnPath } from "@onetrips/shared";

function startPath(params: URLSearchParams) {
  const sessionId = params.get("sid");
  const offerId = params.get("offer");
  const product = params.get("product");
  if (!sessionId || !offerId) return null;
  const next = new URLSearchParams();
  next.set("sid", sessionId);
  next.set("offer", offerId);
  if (product === "HOTEL") next.set("product", "HOTEL");
  return `/booking/start?${next.toString()}`;
}

function StartInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const started = useRef(false);

  useEffect(() => {
    const sessionId = params.get("sid");
    const offerId = params.get("offer");
    if (!sessionId || !offerId) {
      setError("Missing fare selection.");
      setCode("MISSING_SELECTION");
      return;
    }
    if (started.current) return;
    started.current = true;

    void (async () => {
      const session = await ensureCustomerSession();
      if (!session) {
        const resume = startPath(params);
        const next = resume && isSafeReturnPath(resume) ? resume : "/login/customer";
        router.replace(`/login/customer?next=${encodeURIComponent(next)}`);
        return;
      }

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            offerId,
            ...(params.get("product") === "HOTEL" ? { product: "HOTEL" } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          const resume = startPath(params);
          const next = resume && isSafeReturnPath(resume) ? resume : "/login/customer";
          router.replace(`/login/customer?next=${encodeURIComponent(next)}`);
          return;
        }
        if (!res.ok) {
          setCode(typeof data.code === "string" ? data.code : "BOOKING_START_FAILED");
          setError(data.message || "Unable to start booking");
          return;
        }
        router.replace(`/booking/${data.booking.id}`);
      } catch {
        setCode("NETWORK");
        setError("Unable to start booking");
      }
    })();
  }, [params, router]);

  const expired = code === "SEARCH_EXPIRED" || code === "OFFER_NOT_FOUND" || code === "HOTEL_NOT_FOUND" || code === "FARE_UNAVAILABLE";
  const product = params.get("product") === "HOTEL" ? "hotels" : "flights";

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      {error ? (
        <div className="max-w-lg w-full">
          <ErrorState
            title={expired ? "This fare is no longer available" : "Unable to start booking"}
            description={error}
            action={
              <Link href={`/${product}`} className="font-black uppercase tracking-widest text-gold-dark" data-testid="booking-start-alternatives">
                View alternatives
              </Link>
            }
          />
        </div>
      ) : (
        <div className="text-center" role="status" aria-live="polite">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin mx-auto mb-6" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirming fare</p>
        </div>
      )}
    </main>
  );
}

export default function BookingStartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      }
    >
      <StartInner />
    </Suspense>
  );
}
