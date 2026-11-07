'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, LayoutDashboard, Navigation, Truck, UserRound, Users, Building2, FilePlus, ClipboardCheck, KeyRound, BarChart3, MapPinned, MapPin, LogOut, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiBaseUrl, getCurrentSession, getSelectedTenantId, hasPermission, setSelectedTenantId, type SessionUser } from '@/lib/api';

const items = [
  { href: '/tenant', label: 'Ringkasan', icon: LayoutDashboard, permission: 'tenant:read' },
  { href: '/trips', label: 'Perjalanan', icon: Navigation, permission: 'trip:read' },
  { href: '/tenant/drivers', label: 'Driver', icon: UserRound, permission: 'master:read' },
  { href: '/tenant/vehicles', label: 'Kendaraan', icon: Truck, permission: 'master:read' },
  { href: '/tenant/users', label: 'Pengguna', icon: Users, permission: 'tenant:read' },
  { href: '/tenant/recipients', label: 'Penerima', icon: MapPin, permission: 'tenant:manage' },
  { href: '/tenant/activation', label: 'Aktivasi Akun', icon: KeyRound, permission: 'tenant:manage' },
  { href: '/tenant/recipient-registrations', label: 'Registrasi Penerima', icon: QrCode, permission: 'tenant:manage' },
  { href: '/tenant/audit', label: 'Audit Aktivitas', icon: Activity, permission: 'tenant:read' },
  { href: '/tenant/profile', label: 'Profil SPPG', icon: Building2, permission: 'tenant:read' },
  { href: '/tenant/map', label: 'Peta', icon: MapPinned, permission: 'master:read' },
  { href: '/exceptions', label: 'Pusat risiko', icon: AlertTriangle, permission: 'exception:read' },
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [selectedTenantId, setSelectedTenantIdState] = useState('');
  useEffect(() => {
    void getCurrentSession().then((current) => {
      setUser(current);
      const memberships = current.tenantMemberships ?? [];
      const savedId = getSelectedTenantId();
      const selected = memberships.some((membership) => membership.tenantId === savedId) ? savedId ?? '' : current.tenantId ?? '';
      setSelectedTenantIdState(selected);
    }).catch(() => undefined);
  }, []);

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
        <span className="workspace-copy"><small>TENANT</small><strong>{user?.tenantMemberships?.find((membership) => membership.tenantId === selectedTenantId)?.tenantName ?? 'Operasional SPPG'}</strong></span>
      </div>
      {(user?.tenantMemberships?.length ?? 0) > 1 && <label className="tenant-context-switcher"><span>AKTIF TENANT</span><select aria-label="Pilih tenant aktif" value={selectedTenantId} onChange={(event) => {
        const nextTenantId = event.target.value;
        setSelectedTenantId(nextTenantId || null);
        setSelectedTenantIdState(nextTenantId);
        window.location.reload();
      }}><option value="">Pilih tenant…</option>{user?.tenantMemberships?.map((membership) => <option key={membership.tenantId} value={membership.tenantId}>{membership.tenantName} · {membership.tenantCode}</option>)}</select></label>}
      <nav className="side-nav">
        <p className="nav-caption">OPERASIONAL</p>
        {items.filter((item) => hasPermission(user, item.permission)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item nav-link${pathname === href ? ' nav-active' : ''}`}>
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
