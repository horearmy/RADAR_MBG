import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { VehiclesChrome } from "@/components/vehicles-chrome";

export default function VehiclesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <Suspense fallback={<aside className="sidebar" />}>
        <AppSidebar />
      </Suspense>
      <VehiclesChrome>{children}</VehiclesChrome>
    </main>
  );
}
