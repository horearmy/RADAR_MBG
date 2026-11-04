"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { HeaderAccount } from "@/components/account-menu";

function crumb(pathname: string) {
  if (pathname.endsWith("/new")) return "Tambah driver";
  if (pathname.endsWith("/edit")) return "Ubah driver";
  if (pathname !== "/drivers") return "Detail driver";
  return "Driver";
}

export function DriversChrome({ children }: { children: React.ReactNode }) {
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
