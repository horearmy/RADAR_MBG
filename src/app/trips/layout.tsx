import { AppSidebar } from "@/components/app-sidebar";

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <section className="main-column">{children}</section>
    </div>
  );
}
