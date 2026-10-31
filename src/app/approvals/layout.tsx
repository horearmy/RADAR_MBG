import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Suspense fallback={<aside className="sidebar" />}>
        <AppSidebar />
      </Suspense>
      <section className="main-column">{children}</section>
    </div>
  );
}
