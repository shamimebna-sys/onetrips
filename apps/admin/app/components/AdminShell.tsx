"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Building2,
  CreditCard,
  FileText,
  Globe2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Percent,
  Plane,
  ScrollText,
  Settings,
  Shield,
  Bell,
  Ticket,
  Users,
  Wallet,
  Cable,
  Scale,
} from "lucide-react";

const groups = [
  {
    label: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/bookings", label: "Bookings", icon: Ticket },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/reconciliation", label: "Reconciliation", icon: Scale },
      { href: "/agencies", label: "Agencies", icon: Building2 },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/pricing", label: "Pricing", icon: Percent },
      { href: "/promotions", label: "Promotions", icon: Percent },
      { href: "/reports", label: "Reports", icon: Wallet },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/users", label: "Users", icon: Shield },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/support", label: "Support", icon: Bell },
      { href: "/audit", label: "Audit", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/integrations/flights", label: "Flight providers", icon: Cable },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/catalog/airports", label: "Airports", icon: Landmark },
      { href: "/catalog/airlines", label: "Airlines", icon: Plane },
      { href: "/catalog/countries", label: "Countries", icon: Globe2 },
      { href: "/catalog/suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-muted flex">
      <aside className="hidden md:flex w-72 bg-white border-r border-slate-100 flex-col">
        <div className="p-8 border-b border-slate-50">
          <Link href="/" className="text-2xl font-black tracking-tighter">
            <span className="text-ink">ONE</span>
            <span className="text-gold">TRIPS</span>
          </Link>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Admin Console</p>
        </div>
        <nav className="p-4 space-y-5 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-[0.25em] text-slate-300">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        active ? "bg-ink text-white" : "text-slate-400 hover:bg-muted hover:text-ink"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-gold" : ""}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-50">
          <button onClick={logout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 min-h-screen">{children}</div>
    </div>
  );
}
