"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ensureCustomerSession, type CustomerSessionUser } from "@onetrips/ui";
import {
  Bell,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Plane,
  Receipt,
  Shield,
  SlidersHorizontal,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

const groups: Array<{
  label: string;
  items: Array<{ href: string; label: string; exact?: boolean; icon: LucideIcon }>;
}> = [
  {
    label: "Overview",
    items: [{ href: "/account", label: "Overview", exact: true, icon: LayoutDashboard }],
  },
  {
    label: "Travel",
    items: [
      { href: "/account/trips", label: "My Trips", icon: Plane },
      { href: "/account/travelers", label: "Travelers", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/account/profile", label: "Profile", icon: User },
      { href: "/account/payments", label: "Payments", icon: CreditCard },
      { href: "/account/invoices", label: "Invoices", icon: Receipt },
      { href: "/account/notifications", label: "Notifications", icon: Bell },
      { href: "/account/preferences", label: "Preferences", icon: SlidersHorizontal },
      { href: "/account/security", label: "Security", icon: Shield },
    ],
  },
  {
    label: "Help",
    items: [{ href: "/account/support", label: "Support", icon: HelpCircle }],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAccountPath(pathname: string) {
  return pathname === "/account" || pathname.startsWith("/account/");
}

function shouldShowAccountSidebar(pathname: string) {
  return isAccountPath(pathname) || pathname === "/flights" || pathname === "/hotels" || pathname === "/offers";
}

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CustomerSessionUser | null>(null);
  const [unread, setUnread] = useState(0);
  const showSidebar = Boolean(user) && shouldShowAccountSidebar(pathname);

  useEffect(() => {
    let cancelled = false;
    ensureCustomerSession().then((sessionUser) => {
      if (cancelled) return;
      if (!sessionUser && isAccountPath(pathname)) {
        const next = `${pathname}${window.location.search}`;
        router.push(`/login/customer?next=${encodeURIComponent(next.startsWith("/") ? next : "/account")}`);
        return;
      }
      setUser(sessionUser);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!showSidebar) return;
    let cancelled = false;
    fetch("/api/account/notifications?unread=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && typeof body?.unreadCount === "number") setUnread(body.unreadCount);
      });
    return () => {
      cancelled = true;
    };
  }, [showSidebar, pathname]);

  if (isAccountPath(pathname) && !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold-accent/20 border-t-gold-accent" />
      </div>
    );
  }

  if (!showSidebar) {
    return children;
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-6 md:py-8">
      <div className="md:grid md:grid-cols-[228px_minmax(0,1fr)] md:items-start md:gap-7 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden w-full self-start md:block" aria-label="Account" data-testid="account-sidebar">
          <nav className="sticky top-24 rounded-[18px] border border-line bg-white px-3 py-3.5 shadow-[0_14px_40px_rgba(16,23,42,0.06)]">
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.label}>
                  <p className="mb-1.5 px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-copy-muted">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href, item.exact);
                      const Icon = item.icon;
                      const showUnread = item.href === "/account/notifications" && unread > 0;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            aria-label={showUnread ? `Notifications, ${unread} unread` : undefined}
                            className={`group relative flex h-[42px] items-center gap-3 rounded-[11px] px-3.5 text-[14px] leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-accent/45 ${
                              active
                                ? "bg-gold-soft font-semibold text-navy"
                                : "font-medium text-navy/90 hover:bg-gold-soft/80 hover:text-navy"
                            }`}
                          >
                            {active ? (
                              <span
                                aria-hidden
                                className="absolute top-1/2 left-0 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-gold-accent"
                              />
                            ) : null}
                            <span
                              aria-hidden
                              className={`inline-flex size-[18px] shrink-0 items-center justify-center transition-colors duration-150 ${
                                active ? "text-gold-accent" : "text-copy-muted group-hover:text-gold-accent"
                              }`}
                            >
                              <Icon size={18} strokeWidth={1.75} className="block size-[18px]" />
                            </span>
                            <span className="min-w-0 truncate">{item.label}</span>
                            {showUnread ? (
                              <span
                                aria-hidden
                                className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-gold-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-navy"
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
