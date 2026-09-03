import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offers and promo codes | ONETRIPS",
  description: "Active ONETRIPS campaigns and promo codes for eligible flights and hotels.",
  alternates: { canonical: "/offers" },
  openGraph: {
    title: "Offers and promo codes | ONETRIPS",
    description: "Active ONETRIPS campaigns and promo codes for eligible flights and hotels.",
  },
};

export default function OffersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
