"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  Command,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Navigation,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  Utensils,
} from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type NavItem = { label: string; icon: typeof LayoutDashboard; href?: string; permissions?: string[] };

const navigation: NavItem[] = [
  { label: "Ringkasan", icon: LayoutDashboard, href: "/" },
  { label: "Peta langsung", icon: MapPinned, href: "/#live-map", permissions: ["trip:track:read"] },
  { label: "Perjalanan", icon: Navigation, href: "/trips", permissions: ["trip:read"] },
  { label: "Pusat risiko", icon: AlertTriangle, href: "/exceptions", permissions: ["exception:read"] },
];

const management: NavItem[] = [
  { label: "SPPG", icon: Utensils, permissions: ["master:read", "sppg:read", "organization:read"] },
  { label: "Kendaraan", icon: Truck, permissions: ["master:read"] },
];

export function AppSidebar() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getCurrentSession();
        if (active) setUser(current);
      } catch {
        if (active) router.replace("/login?expired=1");
      }
    })();
    return () => { active = false; };
  }, [router]);

  if (!user) return <aside className="sidebar" aria-busy="true" />;

  const canReadAudit = hasPermission(user, "audit:read");
  const canManageUsers = hasPermission(user, "admin:manage_users");
  const canAccessApprovals = hasPermission(user, "sppg:manage") || hasPermission(user, "approval:review");
  const canDrive = hasPermission(user, "trip:start") && hasPermission(user, "trip:location:update");
  const canAccessGeofences = hasPermission(user, "geofence:read") || hasPermission(user, "geofence:manage");
  const canManageAdmin = hasPermission(user, "admin:manage_users") || hasPermission(user, "admin:manage_roles");

  const canAccessNav = (item: NavItem) => !item.permissions || item.permissions.some((permission) => hasPermission(user, permission));

  async function logout() {
    try {
      const csrfResponse = await fetch(`${process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1"}/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });
      const { csrfToken } = await csrfResponse.json() as { csrfToken?: string };
      if (csrfToken) {
        await fetch(`${process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1"}/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: { "x-csrf-token": csrfToken },
        });
      }
    } finally {
      router.replace("/login");
    }
  }

  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="RADAR MBG beranda">
        <span className="brand-mark"><span /><span /><span /></span>
        <span className="brand-copy"><strong>RADAR<span>MBG</span></strong><small>Operational intelligence</small></span>
      </Link>

      <div className="workspace-switcher">
        <span className="workspace-icon"><Command size={17} /></span>
        <span className="workspace-copy"><small>WORKSPACE</small><strong>Pusat Operasional</strong></span>
        <ChevronDown size={15} className="muted-icon" />
      </div>

      <nav className="side-nav" aria-label="Navigasi utama">
        <p className="nav-caption">MONITORING</p>
        {navigation.filter(canAccessNav).map(({ label, icon: Icon, href }) => (
          <Link key={label} className="nav-item nav-link" href={href ?? "/"}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
          </Link>
        ))}
        <p className="nav-caption nav-caption-spaced">OPERASIONAL</p>
        <Link className="nav-item nav-link" href="/sppg"><Utensils size={17} strokeWidth={1.8} /><span>SPPG</span></Link>
        {management.filter((item) => item.label !== "SPPG").filter(canAccessNav).map(({ label, icon: Icon }) => (
          <button key={label} className="nav-item nav-item-soon" disabled title={`${label} segera hadir`}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span><small className="nav-soon-tag">Segera</small>
          </button>
        ))}
        {canReadAudit && <Link className="nav-item nav-link" href="/audit"><Activity size={17} strokeWidth={1.8} /><span>Audit explorer</span></Link>}
        {canManageUsers && <Link className="nav-item nav-link" href="/users"><Users size={17} strokeWidth={1.8} /><span>Administrasi akun</span></Link>}
        {canAccessGeofences && <Link className="nav-item nav-link" href="/geofences"><MapPinned size={17} strokeWidth={1.8} /><span>Geofence</span></Link>}
        {user.mfaEnabled === false && <Link className="nav-item nav-link" href="/security/mfa"><ShieldCheck size={17} strokeWidth={1.8} /><span>Daftarkan MFA</span></Link>}
        {canAccessApprovals && <Link className="nav-item nav-link" href="/approvals"><ClipboardCheck size={17} strokeWidth={1.8} /><span>Persetujuan</span></Link>}
        {canDrive && (
          <>
            <p className="nav-caption nav-caption-spaced">PENGEMUDI</p>
            <Link className="nav-item nav-link" href="/driver">
              <Navigation size={17} strokeWidth={1.8} /><span>Mode pengemudi</span>
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-help"><div className="help-icon"><Activity size={17} /></div><div><strong>Data operasional</strong><span>Terhubung ke API RADAR MBG</span></div></div>
        {canManageAdmin && <button className="nav-item settings-item nav-item-soon" disabled title="Pengaturan segera hadir"><Settings2 size={17} /><span>Pengaturan</span><small className="nav-soon-tag">Segera</small></button>}
        <div className="profile-row"><div className="profile-avatar">{user.displayName.slice(0, 2).toUpperCase()}</div><div className="profile-copy"><strong>{user.displayName}</strong><span>{user.roles[0]?.code ?? "Pengguna"}</span></div><button className="profile-logout" onClick={logout} aria-label="Keluar"><LogOut size={16} /></button></div>
      </div>
    </aside>
  );
}
