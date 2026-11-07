"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/platform/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<aside className="sidebar" />}>
        <AppSidebar />
      </Suspense>
      <section className="main-column">
        <div className="content-area">{children}</div>
      </section>
    </div>
  );
}
