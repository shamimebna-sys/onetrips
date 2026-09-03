import Link from "next/link";
import { EmptyState } from "@onetrips/ui";
import { contentMetadata } from "@/components/ContentPage";

export const metadata = contentMetadata("Support", "Contact ONETRIPS about a booking or general question.");

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <EmptyState
        title="How can we help?"
        description="For general questions see Help and FAQ. For a specific booking, sign in and open Account Support so we can attach your request to the trip."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/help"
              className="inline-flex rounded-xl border border-slate-200 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-ink"
            >
              Help centre
            </Link>
            <Link
              href="/account/support"
              className="inline-flex rounded-xl bg-ink px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-gold"
            >
              Booking support
            </Link>
          </div>
        }
      />
    </main>
  );
}
