import type { Metadata } from "next";
import { Card } from "@onetrips/ui";

export type ContentPageProps = {
  title: string;
  kicker?: string;
  children: React.ReactNode;
};

export function ContentPage({ title, kicker = "ONETRIPS", children }: ContentPageProps) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{kicker}</p>
      <h1 className="mb-8 text-4xl font-black uppercase tracking-tighter text-ink">{title}</h1>
      <Card className="p-8 md:p-12 text-sm font-medium leading-relaxed text-slate-600 space-y-4">{children}</Card>
    </main>
  );
}

export function contentMetadata(title: string, description: string): Metadata {
  return {
    title: `${title} | ONETRIPS`,
    description,
    openGraph: { title: `${title} | ONETRIPS`, description, type: "website" },
  };
}
