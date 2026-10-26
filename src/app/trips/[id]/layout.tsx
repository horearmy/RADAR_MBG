import { Suspense, type ReactNode } from "react";

export default function TripDetailLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="session-state">
          <span className="session-spinner" />
          <p>Memuat detail perjalanan...</p>
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
