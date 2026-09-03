"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureCustomerSession } from "../session";
import { AccountMenu } from "./AccountMenu";
import { BrandLogo } from "./BrandLogo";

const links = [
  { href: "/flights", label: "Flights" },
  { href: "/hotels", label: "Hotels" },
  { href: "/offers", label: "Offers" },
  { href: "/account/trips", label: "My Trips", auth: true },
];

type Identity = {
  name: string;
  email: string | null;
  photoUrl: string | null;
};

export function SiteHeader() {
  const pathname = usePathname();
  const onProtected =
    pathname.startsWith("/account") || pathname.startsWith("/booking") || pathname.startsWith("/welcome");
  const [signedIn, setSignedIn] = useState(false);
  const [unread, setUnread] = useState(0);
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureCustomerSession()
      .then(async (user) => {
        if (cancelled) return;
        const ok = Boolean(user);
        setSignedIn(ok);
        if (!user) {
          setIdentity(null);
          setUnread(0);
          return;
        }
        const displayName = typeof user.displayName === "string" ? user.displayName : "";
        const email = user.email ?? null;
        setIdentity({ name: displayName || "Customer", email, photoUrl: null });
        const [profileRes, inboxRes] = await Promise.all([
          fetch("/api/account/profile", { credentials: "same-origin" }),
          fetch("/api/account/notifications?unread=1", { credentials: "same-origin" }),
        ]);
        if (cancelled) return;
        if (profileRes.ok) {
          const profileBody = await profileRes.json();
          const profile = profileBody.profile;
          const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || displayName || "Customer";
          setIdentity({ name, email: profile?.email ?? email, photoUrl: profile?.photoUrl ?? null });
        }
        if (inboxRes.ok) {
          const inbox = await inboxRes.json();
          if (typeof inbox?.unreadCount === "number") setUnread(inbox.unreadCount);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedIn(false);
          setIdentity(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 min-w-0 max-w-[1320px] items-center gap-3 px-4 md:gap-4 md:px-6">
        <div className="shrink-0">
          <BrandLogo href={signedIn || onProtected ? "/account" : "/"} size="md" variant="upper" />
        </div>
        <nav aria-label="Primary" className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {links
            .filter((link) => !link.auth || signedIn)
            .map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[11px] font-semibold uppercase tracking-widest ${
                    active ? "border-b-2 border-gold-accent pb-1 text-navy" : "text-copy-muted hover:text-navy"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {signedIn ? (
            <Link
              href="/account/notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy hover:bg-field focus:outline-none focus:ring-2 ring-gold-accent"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              data-testid="header-notifications"
            >
              <BellIcon />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-gold-accent px-1 text-center text-[10px] font-black text-navy">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link
            href="/help"
            className="hidden text-[11px] font-semibold uppercase tracking-widest text-copy-muted hover:text-navy md:inline"
          >
            Help
          </Link>
          <AccountMenu signedIn={signedIn} identity={identity} />
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
