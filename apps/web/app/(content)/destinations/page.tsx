import Link from "next/link";
import { contentMetadata } from "@/components/ContentPage";
import { DESTINATIONS } from "@/lib/destinations";

export const metadata = contentMetadata("Destinations", "Popular destinations on ONETRIPS.");

export default function DestinationsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-4xl font-black uppercase tracking-tighter">Destinations</h1>
      <div className="grid gap-4">
        {DESTINATIONS.map((row) => (
          <Link
            key={row.slug}
            href={`/destination/${row.slug}`}
            className="rounded-[2rem] border border-slate-100 bg-white p-6 hover:border-gold"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gold-dark">{row.code}</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tighter">{row.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{row.blurb}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
