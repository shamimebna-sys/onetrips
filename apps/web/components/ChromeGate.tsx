"use client";

import { usePathname } from "next/navigation";
import { MobileTabBar, SiteFooter, SiteHeader } from "@onetrips/ui";
import { AccountShell } from "@/app/account/AccountShell";

const CONTENT_PREFIXES = [
  "/offers",
  "/about",
  "/contact",
  "/destinations",
  "/destination",
  "/support",
  "/cancellation-policy",
  "/refund-policy",
  "/privacy",
  "/terms",
  "/faq",
  "/help",
];

function shouldUseSharedChrome(pathname: string) {
  if (pathname.startsWith("/account")) return true;
  if (pathname.startsWith("/flights")) return true;
  if (pathname.startsWith("/hotels")) return true;
  if (pathname.startsWith("/booking")) return true;
  if (pathname.startsWith("/welcome")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/login/customer")) return true;
  if (pathname.startsWith("/verify")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  return CONTENT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!shouldUseSharedChrome(pathname)) return children;
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-canvas text-copy">
      <SiteHeader />
      <div id="main-content" className="flex-1 pb-20 md:pb-0">
        <AccountShell>{children}</AccountShell>
      </div>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
