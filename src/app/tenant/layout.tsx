import type { ReactNode } from "react";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { HeaderAccount } from "@/components/account-menu";

export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span></div>
          <div className="topbar-actions">
            <HeaderAccount user={null} />
          </div>
        </header>
        <main className="content-area">{children}</main>
      </section>
    </div>
  );
}