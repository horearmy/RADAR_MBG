"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Home, Truck, Building2 } from "lucide-react";

type BottomNavProps = {
  onSectionChange: (section: "ringkasan" | "driver" | "kendaraan") => void;
  hasFeature: (feature: string) => boolean;
};

export function BottomNavBar({ onSectionChange, hasFeature }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState<"ringkasan" | "driver" | "kendaraan">(
    pathname === "/driver" || pathname === "/" ? "ringkasan" : pathname.startsWith("/drivers") ? "driver" : pathname.startsWith("/vehicles") ? "kendaraan" : "ringkasan"
  );

  const handleClick = (section: "ringkasan" | "driver" | "kendaraan") => {
    setActive(section);
    onSectionChange(section);
    switch (section) {
      case "ringkasan":
        router.push("/");
        break;
      case "driver":
        router.push("/driver");
        break;
      case "kendaraan":
        router.push("/vehicles");
        break;
    }
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "#fff",
        borderTop: "1px solid #e0e0e0",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 1000,
      }}
    >
      <div style={{ display: "flex", gap: 32 }}>
        <Link
          href="/"
          className={`nav-item ${active === "ringkasan" ? "active" : ""}`}
          onClick={() => handleClick("ringkasan")}
          style={{
            display: "grid",
            placeItems: "center",
            color: active === "ringkasan" ? "#1677FF" : "#9aa5b3",
            fontSize: 18,
            transition: "color 0.15s",
            textDecoration: "none",
          }}
        >
          <Home size={24} />
        </Link>

        {hasFeature("drivers") && (
          <Link
            href="/driver"
            className={`nav-item ${active === "driver" ? "active" : ""}`}
            onClick={() => handleClick("driver")}
            style={{
              display: "grid",
              placeItems: "center",
              color: active === "driver" ? "#1677FF" : "#9aa5b3",
              fontSize: 18,
              transition: "color 0.15s",
              textDecoration: "none",
            }}
          >
            <Truck size={24} />
          </Link>
        )}

        {hasFeature("vehicles") && (
          <Link
            href="/vehicles"
            className={`nav-item ${active === "kendaraan" ? "active" : ""}`}
            onClick={() => handleClick("kendaraan")}
            style={{
              display: "grid",
              placeItems: "center",
              color: active === "kendaraan" ? "#1677FF" : "#9aa5b3",
              fontSize: 18,
              transition: "color 0.15s",
              textDecoration: "none",
            }}
          >
            <Building2 size={24} />
          </Link>
        )}
      </div>

      <span style={{ color: "#62728a", fontSize: 11, marginLeft: 16 }}>
        RADAR MBG
        <small style={{ color: "#9aa5b3", fontSize: 9 }}>. Operasional</small>
      </span>
    </nav>
  );
}