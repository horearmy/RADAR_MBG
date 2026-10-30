import { TenantSidebar } from "@/components/tenant-sidebar";
import { HeaderAccount } from "@/components/account-menu";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb">Workspace SPPG <strong>/ Operasional</strong></div>
          <div className="topbar-actions"><HeaderAccount /></div>
        </header>
        <div className="content-area">{children}</div>
      </section>
    </div>
  );
}
