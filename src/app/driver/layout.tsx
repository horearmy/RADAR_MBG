import { Suspense } from "react";
import { DriverShell } from "@/components/driver-shell";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Memuat...</div>}>
      <DriverShell>{children}</DriverShell>
    </Suspense>
  );
}
