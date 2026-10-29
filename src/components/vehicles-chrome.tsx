"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { HeaderAccount } from "@/components/account-menu";

function crumb(pathname: string) {
  if (pathname.endsWith("/new")) return "Tambah kendaraan";
  if (pathname.endsWith("/edit")) return "Ubah kendaraan";
  if (pathname !== "/vehicles") return "Detail kendaraan";
  return "Kendaraan";
}

export function VehiclesChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="main-column">
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <ChevronRight size={14} />
          <strong>{crumb(pathname)}</strong>
        </div>
        <HeaderAccount />
      </header>
      <div className="content-area">{children}</div>
    </section>
  );
}
