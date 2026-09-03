import Link from "next/link";
import { EmptyState } from "@onetrips/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <EmptyState
        title="Page not found"
        description="That address is not part of the ONETRIPS customer portal."
        action={
          <Link href="/" className="inline-flex rounded-xl bg-ink px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white">
            Back to home
          </Link>
        }
      />
    </main>
  );
}
