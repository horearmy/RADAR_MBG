'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutDashboard, Navigation, Truck, UserRound, Users, Building2, FilePlus, ClipboardCheck, KeyRound, BarChart3 } from 'lucide-react';

const items = [
  { href: '/tenant', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/tenant/trips', label: 'Perjalanan', icon: Navigation },
  { href: '/tenant/drivers', label: 'Driver', icon: UserRound },
  { href: '/tenant/vehicles', label: 'Kendaraan', icon: Truck },
  { href: '/tenant/users', label: 'Pengguna', icon: Users },
  { href: '/tenant/audit', label: 'Audit Aktivitas', icon: Activity },
  { href: '/tenant/profile', label: 'Profil SPPG', icon: Building2 },
];

const links = [
  { href: '/register', label: 'Pendaftaran SPPG', icon: FilePlus },
  { href: '/register/status', label: 'Status Pendaftaran', icon: ClipboardCheck },
  { href: '/acceptinvitation', label: 'Aktivasi Akun', icon: KeyRound },
  { href: '/reporting', label: 'Laporan', icon: BarChart3 },
];

export function TenantSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand" href="/tenant">
        <span className="brand-mark"><span /><span /><span /></span>
        <span className="brand-copy"><strong>RADAR<span>MBG</span></strong><small>Workspace SPPG</small></span>
      </Link>
      <div className="workspace-switcher">
        <span className="workspace-icon"><Building2 size={16} /></span>
        <span className="workspace-copy"><small>TENANT</small><strong>Operasional SPPG</strong></span>
      </div>
      <nav className="side-nav">
        <p className="nav-caption">OPERASIONAL</p>
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item nav-link${pathname === href ? ' nav-active' : ''}`}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
          </Link>
        ))}
        {/* Tautan dipindahkan ke halaman utama */}
      </nav>
    </aside>
  );
}
