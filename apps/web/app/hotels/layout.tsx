import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search hotels | ONETRIPS",
  description: "Find hotel rooms with board, cancellation policy, and an itemized stay price.",
  alternates: { canonical: "/hotels" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Search hotels | ONETRIPS",
    description: "Find hotel rooms with board, cancellation policy, and an itemized stay price.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
