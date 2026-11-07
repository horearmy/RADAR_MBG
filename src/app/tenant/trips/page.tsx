"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/field-ui";

export default function TenantTripsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/trips");
  }, [router]);

  return (
    <main className="field-app">
      <div className="field-content">
        <LoadingSkeleton count={2} />
        <p className="field-caption" style={{ textAlign: "center" }}>Mengalihkan ke halaman perjalanan...</p>
      </div>
    </main>
  );
}
