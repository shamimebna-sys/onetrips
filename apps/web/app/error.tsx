"use client";

import Link from "next/link";
import { ErrorState } from "@onetrips/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <ErrorState
        title="Something went wrong"
        description="Please try again. Your booking and payment status are stored on the server."
        action={
          <div className="flex justify-center gap-4">
            <button type="button" onClick={reset} className="rounded-xl bg-ink px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white">
              Try again
            </button>
            <Link href="/" className="rounded-xl border border-slate-200 px-6 py-3 text-[10px] font-black uppercase tracking-widest">
              Home
            </Link>
          </div>
        }
      />
    </main>
  );
}
