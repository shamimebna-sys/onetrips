"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CustomerAvatar } from "./CustomerAvatar";

const items = [
  { href: "/account", label: "My Account" },
  { href: "/account/trips", label: "My Trips" },
  { href: "/account/travelers", label: "Travelers" },
  { href: "/account/payments", label: "Payments" },
  { href: "/account/invoices", label: "Invoices" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/preferences", label: "Preferences" },
  { href: "/account/security", label: "Security" },
];

type Identity = {
  name: string;
  email: string | null;
  photoUrl: string | null;
};

type AccountMenuProps = {
  signedIn: boolean;
  identity?: Identity | null;
};

export function AccountMenu({ signedIn, identity }: AccountMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const name = identity?.name?.trim() || "Customer";
  const email = identity?.email ?? "";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  if (!signedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login/customer" className="text-xs font-black uppercase tracking-widest text-ink hover:text-gold">
          Login
        </Link>
        <Link href="/signup" className="rounded-xl bg-ink px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-gold">
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        data-testid="account-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[14rem] items-center gap-2 rounded-xl border border-line bg-white px-2 py-1.5 text-left hover:border-gold-accent focus:outline-none focus:ring-2 ring-gold-accent"
      >
        <CustomerAvatar name={name} photoUrl={identity?.photoUrl} size="sm" />
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-xs font-semibold text-navy" title={name}>
            {name}
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[70] mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-card"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <CustomerAvatar name={name} photoUrl={identity?.photoUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy" title={name}>
                {name}
              </p>
              {email ? (
                <p className="truncate text-xs font-medium text-copy-muted" title={email}>
                  {email}
                </p>
              ) : null}
            </div>
          </div>
          <ul className="p-2">
            {items.map((item) => (
              <li key={item.href} role="none">
                <Link
                  role="menuitem"
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-copy-muted hover:bg-gold-soft hover:text-navy"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li role="none">
              <Link
                role="menuitem"
                href="/account/support"
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-copy-muted hover:bg-gold-soft hover:text-navy"
              >
                Help & Support
              </Link>
            </li>
          </ul>
          <div className="border-t border-line p-2">
            <button
              type="button"
              role="menuitem"
              aria-label="Logout"
              onClick={logout}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
