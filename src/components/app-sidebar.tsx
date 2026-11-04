"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Command,
  FilePlus,
  KeyRound,
  LayoutDashboard,
  MapPinned,
  Navigation,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  Utensils,
} from "lucide-react";
import { getCurrentSession, getSelectedTenantId, hasPermission, hasPlatformPermission, isPlatformAdmin, setSelectedTenantId, type SessionUser } from "@/lib/api";

type NavItem = { label: string; icon: typeof LayoutDashboard; href?: string; permissions?: string[] };

const navigation: NavItem[] = [
  { label: "Ringkasan", icon: LayoutDashboard, href: "/" },
  { label: "Peta langsung", icon: MapPinned, href: "/#live-map", permissions: ["trip:track:read"] },
  { label: "Perjalanan", icon: Navigation, href: "/trips", permissions: ["trip:read"] },
  { label: "Pusat risiko", icon: AlertTriangle, href: "/exceptions", permissions: ["exception:read"] },
];

const management: NavItem[] = [
  { label: "Driver", icon: Users, href: "/drivers", permissions: ["master:read"] },
  { label: "Kendaraan", icon: Truck, href: "/vehicles", permissions: ["master:read"] },
];

const links: NavItem[] = [
  { label: "Pendaftaran SPPG", icon: FilePlus, href: "/register" },
  { label: "Status Pendaftaran", icon: ClipboardCheck, href: "/register/status" },
  { label: "Aktivasi Akun", icon: KeyRound, href: "/acceptinvitation" },
  { label: "Laporan", icon: BarChart3, href: "/reporting", permissions: ["report:read"] },
  { label: "Workspace Tenant", icon: Building2, href: "/tenant" },
];

function isNavActive(href: string | undefined, pathname: string) {
  if (!href || href.startsWith("/#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [selectedTenantId, setSelectedTenantIdState] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getCurrentSession();
        if (active) {
          setUser(current);
          const memberships = current.tenantMemberships ?? [];
          const savedTenantId = getSelectedTenantId();
          const validTenantId = memberships.some((membership) => membership.tenantId === savedTenantId) ? savedTenantId : "";
          if (validTenantId) setSelectedTenantIdState(validTenantId);
          else if (memberships.length === 1) {
            setSelectedTenantId(memberships[0].tenantId);
            setSelectedTenantIdState(memberships[0].tenantId);
          } else {
            setSelectedTenantId(null);
          }
          if (current.roles.some((role) => role.isGlobal)) {
            setSelectedTenantId(null);
            setSelectedTenantIdState("");
          }
        }
      } catch {
        if (active) router.replace("/login?expired=1");
      }
    })();
    return () => { active = false; };
  }, [router]);

  if (!user) return <aside className="sidebar" aria-busy="true" />;

  const canReadAudit = hasPlatformPermission(user, "audit:read");
  const canManageUsers = hasPermission(user, "admin:manage_users");
  const canAccessApprovals = hasPermission(user, "sppg:manage") || hasPermission(user, "approval:review");
  const canDrive = hasPermission(user, "trip:start") && hasPermission(user, "trip:location:update");
  const canAccessGeofences = hasPlatformPermission(user, "geofence:read") || hasPlatformPermission(user, "geofence:manage");
  const canManageAdmin = hasPlatformPermission(user, "admin:manage_users") || hasPlatformPermission(user, "admin:manage_roles");
  const platformAdmin = isPlatformAdmin(user);
  const memberships = user.tenantMemberships ?? [];

  const canAccessNav = (item: NavItem) => !item.permissions || item.permissions.some((permission) => hasPermission(user, permission));

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
          <Link key={label} className={`nav-item nav-link${isNavActive(href, pathname) ? " nav-active" : ""}`} href={href ?? "/"}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
          </Link>
        ))}
        <p className="nav-caption nav-caption-spaced">OPERASIONAL</p>
        {hasPlatformPermission(user, "sppg:read") || hasPlatformPermission(user, "master:read") ? (
          <Link className={`nav-item nav-link${isNavActive("/sppg", pathname) ? " nav-active" : ""}`} href="/sppg">
            <Utensils size={17} strokeWidth={1.8} /><span>SPPG</span>
          </Link>
        ) : null}
        {platformAdmin ? (
          <Link className={`nav-item nav-link${isNavActive("/platform", pathname) ? " nav-active" : ""}`} href="/platform">
            <Building2 size={17} strokeWidth={1.8} /><span>Tenant</span>
          </Link>
        ) : null}
        {memberships.length > 0 && (
          <Link className={`nav-item nav-link${isNavActive("/tenant", pathname) ? " nav-active" : ""}`} href="/tenant">
            <Building2 size={17} strokeWidth={1.8} /><span>Workspace Tenant</span>
          </Link>
        )}
        {management.filter(canAccessNav).map(({ label, icon: Icon, href }) => {
          if (!href) return null;
          return (
            <Link key={label} className={`nav-item nav-link${isNavActive(href, pathname) ? " nav-active" : ""}`} href={href}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          );
        })}
        {/* Tautan dipindahkan ke halaman utama */}
        {canReadAudit && <Link className="nav-item nav-link" href="/audit"><Activity size={17} strokeWidth={1.8} /><span>Audit explorer</span></Link>}
        {(canManageUsers || canAccessApprovals) && <Link className={`nav-item nav-link${isNavActive("/user-management", pathname) ? " nav-active" : ""}`} href="/user-management"><Users size={17} strokeWidth={1.8} /><span>Manajemen Pengguna</span></Link>}
        {canAccessGeofences && <Link className="nav-item nav-link" href="/geofences"><MapPinned size={17} strokeWidth={1.8} /><span>Geofence</span></Link>}
        {user.mfaEnabled === false && <Link className="nav-item nav-link" href="/security/mfa"><ShieldCheck size={17} strokeWidth={1.8} /><span>Daftarkan MFA</span></Link>}
        {canDrive && <Link className={`nav-item nav-link${isNavActive("/driver", pathname) ? " nav-active" : ""}`} href="/driver"><Navigation size={17} strokeWidth={1.8} /><span>Mode pengemudi</span></Link>}
      </nav>

      {memberships.length > 1 && (
        <label className="tenant-context-switcher">
          <span>AKTIF TENANT</span>
          <select
            aria-label="Pilih tenant aktif"
            value={selectedTenantId}
            onChange={(event) => {
              const nextTenantId = event.target.value;
              setSelectedTenantId(nextTenantId || null);
              setSelectedTenantIdState(nextTenantId);
              window.location.assign(pathname);
            }}
          >
            <option value="">Pilih tenant…</option>
            {memberships.map((membership) => <option key={membership.tenantId} value={membership.tenantId}>{membership.tenantName} · {membership.tenantCode}</option>)}
          </select>
        </label>
      )}

      <div className="sidebar-bottom">
        <div className="sidebar-help"><div className="help-icon"><Activity size={17} /></div><div><strong>Data operasional</strong><span>Terhubung ke API RADAR MBG</span></div></div>
        {canManageAdmin && <button className="nav-item settings-item nav-item-soon" disabled title="Pengaturan segera hadir"><Settings2 size={17} /><span>Pengaturan</span><small className="nav-soon-tag">Segera</small></button>}

      </div>
    </aside>
  );
}
