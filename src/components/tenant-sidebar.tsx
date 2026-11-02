'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, LayoutDashboard, Navigation, Truck, UserRound, Users, Building2, FilePlus, ClipboardCheck, KeyRound, BarChart3, MapPinned, MapPin, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiBaseUrl } from '@/lib/api';

const items = [
  { href: '/tenant', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/tenant/trips', label: 'Perjalanan', icon: Navigation },
  { href: '/tenant/drivers', label: 'Driver', icon: UserRound },
  { href: '/tenant/vehicles', label: 'Kendaraan', icon: Truck },
  { href: '/tenant/users', label: 'Pengguna', icon: Users },
  { href: '/tenant/recipients', label: 'Penerima', icon: MapPin },
  { href: '/tenant/audit', label: 'Audit Aktivitas', icon: Activity },
  { href: '/tenant/profile', label: 'Profil SPPG', icon: Building2 },
  { href: '/tenant/map', label: 'Peta', icon: MapPinned },
];

const links = [
  { href: '/register', label: 'Pendaftaran SPPG', icon: FilePlus },
  { href: '/register/status', label: 'Status Pendaftaran', icon: ClipboardCheck },
  { href: '/acceptinvitation', label: 'Aktivasi Akun', icon: KeyRound },
  { href: '/reporting', label: 'Laporan', icon: BarChart3 },
];

export function TenantSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function logout() {
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
      });
    } finally {
      router.replace('/login');
    }
  }

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
          <Link key={href} href={href} className={`nav-item nav-link${mounted && pathname === href ? ' nav-active' : ''}`} suppressHydrationWarning>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
          </Link>
        ))}
        {/* Tautan dipindahkan ke halaman utama */}
      </nav>
      <div style={{ padding: '12px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <button type="button" onClick={() => void logout()} className="nav-item nav-link" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
          <LogOut size={17} strokeWidth={1.8} /><span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
