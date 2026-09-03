import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search flights | ONETRIPS",
  description: "Compare ONETRIPS flight fares with taxes, baggage, and refundability before you book.",
  alternates: { canonical: "/flights" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Search flights | ONETRIPS",
    description: "Compare ONETRIPS flight fares with taxes, baggage, and refundability before you book.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
