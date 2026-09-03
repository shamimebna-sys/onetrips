"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Building2, CreditCard, FileText, LayoutDashboard, LogOut, Plane, Ticket, Users, Wallet } from "lucide-react";

const nav = [
  { href: "/", label: "Workspace", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Plane },
  { href: "/bookings", label: "Bookings", icon: Ticket },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/credit", label: "Credit", icon: CreditCard },
  { href: "/ledger", label: "Ledger", icon: Building2 },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/team", label: "Team", icon: Users },
];

export function AgencyShell({ children }: { children: ReactNode }) {
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
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Agency Portal</p>
        </div>
        <nav className="p-6 space-y-2 flex-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  active ? "bg-ink text-white" : "text-slate-400 hover:bg-muted hover:text-ink"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-gold" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-6 border-t border-slate-50">
          <button onClick={logout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 min-h-screen">{children}</div>
    </div>
  );
}
