"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Modal } from "./Modal";

export function MobileTabBar() {
  const pathname = usePathname();
  const [bookOpen, setBookOpen] = useState(false);

  const home = pathname === "/";
  const trips = pathname.startsWith("/account/trips") || pathname.startsWith("/account/bookings") || pathname.startsWith("/booking");
  const alerts = pathname.startsWith("/account/notifications");
  const account = pathname.startsWith("/account") && !trips && !alerts;

  return (
    <>
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 px-1 py-1.5 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          <Tab href="/" label="Home" active={home} />
          <Tab href="/account/trips" label="Trips" active={trips} testId="mobile-trips" />
          <li>
            <button
              type="button"
              data-testid="mobile-book"
              onClick={() => setBookOpen(true)}
              className="flex min-h-11 w-full flex-col items-center justify-center rounded-xl px-1 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400"
              aria-label="Book"
            >
              Book
            </button>
          </li>
          <Tab href="/account/notifications" label="Alerts" active={alerts} testId="mobile-alerts" />
          <Tab href="/account" label="Account" active={account} testId="mobile-account" />
        </ul>
      </nav>
      <Modal open={bookOpen} title="Book" onClose={() => setBookOpen(false)}>
        <div className="grid gap-3">
          <Link
            href="/flights"
            data-testid="mobile-book-flights"
            onClick={() => setBookOpen(false)}
            className="rounded-2xl bg-navy px-5 py-4 text-center text-[11px] font-black uppercase tracking-widest text-white"
          >
            Flights
          </Link>
          <Link
            href="/hotels"
            data-testid="mobile-book-hotels"
            onClick={() => setBookOpen(false)}
            className="rounded-2xl border border-line px-5 py-4 text-center text-[11px] font-black uppercase tracking-widest text-navy hover:border-gold-accent"
          >
            Hotels
          </Link>
        </div>
      </Modal>
    </>
  );
}

function Tab({ href, label, active, testId }: { href: string; label: string; active: boolean; testId?: string }) {
  return (
    <li>
      <Link
        href={href}
        data-testid={testId}
        className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1 py-2 text-[9px] font-black uppercase tracking-widest ${
          active ? "text-gold-accent" : "text-copy-muted"
        }`}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </Link>
    </li>
  );
}
