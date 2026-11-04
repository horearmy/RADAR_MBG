import { Suspense } from "react";
import DriverClient from "./driver-client";
import { LoadingSkeleton } from "@/components/field-ui";

export const instant = false;

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="field-app">
          <div className="field-content"><LoadingSkeleton /></div>
        </main>
      }
    >
      <DriverClient />
    </Suspense>
  );
}
