import type { ReactNode } from "react";
import { MobileTabBar } from "./MobileTabBar";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type CustomerShellProps = {
  children: ReactNode;
  hideFooter?: boolean;
};

export function CustomerShell({ children, hideFooter = false }: CustomerShellProps) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-canvas text-copy">
      <SiteHeader />
      <div id="main-content" className="flex-1 pb-20 md:pb-0">
        {children}
      </div>
      {hideFooter ? null : <SiteFooter />}
      <MobileTabBar />
    </div>
  );
}
