import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

const columns = [
  {
    title: "Travel",
    links: [
      { href: "/flights", label: "Flights" },
      { href: "/hotels", label: "Hotels" },
      { href: "/offers", label: "Offers" },
      { href: "/destinations", label: "Destinations" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/help", label: "Help" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refund-policy", label: "Refund policy" },
      { href: "/cancellation-policy", label: "Cancellation policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-100 bg-white pb-24 pt-16 md:pb-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-4">
        <div>
          <BrandLogo href="/" size="lg" variant="upper" />
          <p className="mt-4 max-w-xs text-sm font-medium text-slate-400">
            Enterprise travel for flights and hotels — search, book, and manage every trip in one place.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{column.title}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-12 max-w-7xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-300">
        © {new Date().getFullYear()} ONETRIPS
      </p>
    </footer>
  );
}
