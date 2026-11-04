import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export default function ExceptionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="sidebar" />}>
        <AppSidebar />
      </Suspense>
      <section className="main-column">{children}</section>
    </div>
  );
}
