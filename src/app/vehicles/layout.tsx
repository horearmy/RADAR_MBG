import { AppSidebar } from "@/components/app-sidebar";
import { VehiclesChrome } from "@/components/vehicles-chrome";

export default function VehiclesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <AppSidebar />
      <VehiclesChrome>{children}</VehiclesChrome>
    </main>
  );
}
