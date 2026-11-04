import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DriversChrome } from "@/components/drivers-chrome";

export default function DriversLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <Suspense fallback={<aside className="sidebar" />}>
        <AppSidebar />
      </Suspense>
      <Suspense fallback={<section className="main-column"><div className="content-area">Memuat...</div></section>}>
        <DriversChrome>{children}</DriversChrome>
      </Suspense>
    </main>
  );
}
