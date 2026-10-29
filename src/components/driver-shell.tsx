"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Home, UserRound } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { getCurrentSession } from "@/lib/api";

const tabs = [
  { href: "/driver?tab=home", label: "Beranda", icon: Home },
  { href: "/driver?tab=tasks", label: "Tugas", icon: ClipboardList },
  { href: "/driver?tab=history", label: "Riwayat", icon: CheckCircle2 },
  { href: "/driver?tab=account", label: "Akun", icon: UserRound },
];

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get("tab") || "home";
  const [user, setUser] = useState<null | { displayName: string }>(null);

  useEffect(() => {
    void getCurrentSession()
      .then((current) => setUser({ displayName: current.displayName }))
      .catch(() => setUser(null));
  }, []);

  return (
    <main className="driver-shell">
      <header className="driver-topbar">
        <Link className="driver-brand" href="/driver?tab=home" aria-label="RADAR MBG Driver">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>
            <strong>RADAR<span>MBG</span></strong>
            <small>Driver Console</small>
          </span>
        </Link>
        <HeaderAccount />
      </header>

      <div className="driver-main">{children}</div>

      <nav className="driver-bottom-nav" aria-label="Navigasi driver">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            className={currentTab === href.split("=")[1] ? "driver-bottom-item active" : "driver-bottom-item"}
            href={href}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
