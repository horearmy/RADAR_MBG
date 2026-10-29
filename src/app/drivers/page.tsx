"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Command,
  Eye,
  Filter,

  MapPin,
  MapPinned,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  Utensils,
} from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

type Sppg = {
  id: string;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  organization?: { id: string; code: string; name: string };
  region?: { id: string; code: string; name: string };
  updatedAt?: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  } catch {
    return iso;
  }
}

function statusPill(status: string) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return <span className="pill pill-active">Aktif</span>;
  if (s === "PENDING") return <span className="pill pill-warning">Menunggu Persetujuan</span>;
  if (s === "SUSPENDED") return <span className="pill pill-warning">Perlu Perhatian</span>;
  if (s === "INACTIVE" || s === "ARCHIVED") return <span className="pill pill-neutral">Nonaktif</span>;
  return <span className="pill pill-neutral">{status}</span>;
}

export default function DriversPage() {

  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Sppg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`${apiBase}/admin/drivers?${params.toString()}`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal memuat Driver");
      setRows(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status?.toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.address?.toLowerCase().includes(q) ||
        row.region?.name.toLowerCase().includes(q) ||
        row.organization?.name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const aktif = rows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length;
    const perhatian = rows.filter((r) => r.status?.toUpperCase() === "SUSPENDED").length;
    const nonaktif = rows.filter((r) => {
      const s = r.status?.toUpperCase();
      return s === "INACTIVE" || s === "ARCHIVED";
    }).length;
    return { total, aktif, perhatian, nonaktif };
  }, [rows]);

  const canReadAudit = user ? hasPermission(user, "audit:read") : false;
  const canManageUsers = user ? hasPermission(user, "admin:manage_users") : false;
  const canAccessApprovals = user ? (hasPermission(user, "drivers:manage") || hasPermission(user, "approval:review")) : false;
  const canDrive = user ? (hasPermission(user, "trip:start") && hasPermission(user, "trip:location:update")) : false;
  const canAccessGeofences = user ? (hasPermission(user, "geofence:read") || hasPermission(user, "geofence:manage")) : false;
  const canManageAdmin = user ? (hasPermission(user, "admin:manage_users") || hasPermission(user, "admin:manage_roles")) : false;
  if (user && !hasPermission(user, "master:read") && !hasPermission(user, "drivers:read")) {
    return (
      <main className="app-shell">
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
            <Link className="nav-item nav-link" href="/"><Activity size={17} strokeWidth={1.8} /><span>Ringkasan</span></Link>
            <Link className="nav-item nav-link" href="/trips"><Navigation size={17} strokeWidth={1.8} /><span>Perjalanan</span></Link>
            <Link className="nav-item nav-link" href="/exceptions"><AlertTriangle size={17} strokeWidth={1.8} /><span>Pusat risiko</span></Link>
            <p className="nav-caption nav-caption-spaced">OPERASIONAL</p>
            <Link className="nav-item nav-link" href="/sppg"><Utensils size={17} strokeWidth={1.8} /><span>SPPG</span></Link>
            <Link className="nav-item nav-link nav-active" href="/drivers"><Users size={17} strokeWidth={1.8} /><span>Driver</span></Link>
            <Link className="nav-item nav-link" href="/vehicles"><Truck size={17} strokeWidth={1.8} /><span>Kendaraan</span></Link>
            {canReadAudit && <Link className="nav-item nav-link" href="/audit"><Activity size={17} strokeWidth={1.8} /><span>Audit explorer</span></Link>}
            {canManageUsers && <Link className="nav-item nav-link" href="/users"><Users size={17} strokeWidth={1.8} /><span>Administrasi akun</span></Link>}
            {canAccessGeofences && <Link className="nav-item nav-link" href="/geofences"><MapPinned size={17} strokeWidth={1.8} /><span>Geofence</span></Link>}
            {user?.mfaEnabled === false && <Link className="nav-item nav-link" href="/security/mfa"><ShieldCheck size={17} strokeWidth={1.8} /><span>Daftarkan MFA</span></Link>}
            {canAccessApprovals && <Link className="nav-item nav-link" href="/approvals"><ClipboardCheck size={17} strokeWidth={1.8} /><span>Persetujuan</span></Link>}
            {canDrive && (<><p className="nav-caption nav-caption-spaced">PENGEMUDI</p><Link className="nav-item nav-link" href="/driver"><Navigation size={17} strokeWidth={1.8} /><span>Mode pengemudi</span></Link></>)}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-help"><div className="help-icon"><Activity size={17} /></div><div><strong>Data operasional</strong><span>Terhubung ke API RADAR MBG</span></div></div>
            {canManageAdmin && <button className="nav-item settings-item nav-item-soon" disabled title="Pengaturan segera hadir"><Settings2 size={17} /><span>Pengaturan</span><small className="nav-soon-tag">Segera</small></button>}

          </div>
        </aside>
        <section className="main-column">
          <header className="topbar">
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>Driver</strong></div>
            <HeaderAccount user={user} />
          </header>
          <div className="content-area">
            <div className="page">
              <header className="page-header">
                <div>
                  <p className="page-breadcrumb">Operasional &gt; Driver</p>
                  <h1 className="page-title">Manajemen Driver</h1>
                  <p className="page-subtitle">Kelola profil, lokasi, status operasional, dan aktivitas distribusi setiap Driver.</p>
                </div>
              </header>
              <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
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
          <Link className="nav-item nav-link" href="/"><Activity size={17} strokeWidth={1.8} /><span>Ringkasan</span></Link>
          <Link className="nav-item nav-link" href="/trips"><Navigation size={17} strokeWidth={1.8} /><span>Perjalanan</span></Link>
          <Link className="nav-item nav-link" href="/exceptions"><AlertTriangle size={17} strokeWidth={1.8} /><span>Pusat risiko</span></Link>
          <p className="nav-caption nav-caption-spaced">OPERASIONAL</p>
          <Link className="nav-item nav-link" href="/sppg"><Utensils size={17} strokeWidth={1.8} /><span>SPPG</span></Link>
          <Link className="nav-item nav-link nav-active" href="/drivers"><Users size={17} strokeWidth={1.8} /><span>Driver</span></Link>
          <Link className="nav-item nav-link" href="/vehicles"><Truck size={17} strokeWidth={1.8} /><span>Kendaraan</span></Link>
          {canReadAudit && <Link className="nav-item nav-link" href="/audit"><Activity size={17} strokeWidth={1.8} /><span>Audit explorer</span></Link>}
          {canManageUsers && <Link className="nav-item nav-link" href="/users"><Users size={17} strokeWidth={1.8} /><span>Administrasi akun</span></Link>}
          {canAccessGeofences && <Link className="nav-item nav-link" href="/geofences"><MapPinned size={17} strokeWidth={1.8} /><span>Geofence</span></Link>}
          {user?.mfaEnabled === false && <Link className="nav-item nav-link" href="/security/mfa"><ShieldCheck size={17} strokeWidth={1.8} /><span>Daftarkan MFA</span></Link>}
          {canAccessApprovals && <Link className="nav-item nav-link" href="/approvals"><ClipboardCheck size={17} strokeWidth={1.8} /><span>Persetujuan</span></Link>}
          {canDrive && (<><p className="nav-caption nav-caption-spaced">PENGEMUDI</p><Link className="nav-item nav-link" href="/driver"><Navigation size={17} strokeWidth={1.8} /><span>Mode pengemudi</span></Link></>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><div className="help-icon"><Activity size={17} /></div><div><strong>Data operasional</strong><span>Terhubung ke API RADAR MBG</span></div></div>
          {canManageAdmin && <button className="nav-item settings-item nav-item-soon" disabled title="Pengaturan segera hadir"><Settings2 size={17} /><span>Pengaturan</span><small className="nav-soon-tag">Segera</small></button>}
        </div>
      </aside>
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>Driver</strong></div>
          <HeaderAccount user={user} />
        </header>
        <div className="content-area">
          <div className="page">
            <header className="page-hero">
              <div className="page-hero-content">
                <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Driver</p>
                <div className="page-hero-title-row">
                  <div className="page-hero-icon"><Users size={20} /></div>
                  <div>
                    <h1 className="page-title">Manajemen Driver</h1>
                    <p className="page-subtitle">Kelola profil, lokasi, status operasional, relasi driver & kendaraan, serta aktivitas distribusi setiap unit Driver.</p>
                  </div>
                </div>
              </div>
              <div className="page-actions">
                <button className="btn btn-ghost" onClick={() => load()} disabled={loading}>
                  <RefreshCw size={16} /> Muat ulang
                </button>
                <Link className="btn btn-primary" href="/drivers/new">
                  <Plus size={16} /> Tambah Driver
                </Link>
              </div>
            </header>

            <section className="kpi-grid kpi-grid-4">
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-navy"><Users size={18} /></div>
            <span className="kpi-label">Total Driver</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.total}</div>
          </div>
          <p className="kpi-subtitle">Jumlah unit sesuai lingkup akses</p>
        </article>
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-green"><Building2 size={18} /></div>
            <span className="kpi-label">Aktif</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.aktif}</div>
            <span className="kpi-trend-pill trend-up">Beroperasi</span>
          </div>
          <p className="kpi-subtitle">Unit dengan status aktif</p>
        </article>
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-amber"><AlertTriangle size={18} /></div>
            <span className="kpi-label">Perlu Perhatian</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.perhatian}</div>
            <span className="kpi-trend-pill trend-warn">Tindak lanjut</span>
          </div>
          <p className="kpi-subtitle">Butuh pemeriksaan operasional</p>
        </article>
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-slate"><MapPin size={18} /></div>
            <span className="kpi-label">Nonaktif</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.nonaktif}</div>
          </div>
          <p className="kpi-subtitle">Tidak beroperasi saat ini</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="search-group">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, alamat, wilayah, atau penanggung jawab..." />
          </div>
          <div className="panel-actions">
            <button className="btn btn-ghost" onClick={() => setShowFilters((v) => !v)}>
              <Filter size={16} /> Filter
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="filter-bar">
            <div className="filter-field">
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <option value="ALL">Semua</option>
                <option value="ACTIVE">Aktif</option>
                <option value="PENDING">Menunggu Persetujuan</option>
                <option value="SUSPENDED">Perlu Perhatian</option>
                <option value="INACTIVE">Nonaktif</option>
                <option value="ARCHIVED">Diarsipkan</option>
              </select>
            </div>
            <button className="btn btn-ghost" onClick={() => { setSearch(""); setStatusFilter("ALL"); setPage(1); }}>Reset Filter</button>
          </div>
        )}

        {loading && <div className="table-state">Memuat data Driver...</div>}
        {error && <div className="table-state error">{error}</div>}
        {!loading && !error && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode Driver</th>
                  <th>Nama Driver</th>
                  <th>Lokasi</th>
                  <th>Wilayah</th>
                  <th>Organisasi</th>
                  <th>Status</th>
                  <th>Diperbarui</th>
                  <th className="col-actions">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} className="empty-row">Tidak ada Driver</td></tr>}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td><span className="mono">{row.code}</span></td>
                    <td><strong>{row.name}</strong></td>
                    <td>
                      <div className="cell-stack">
                        <span>{row.address ?? "-"}</span>
                        <span className="text-muted">{row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : "Koordinat belum diisi"}</span>
                      </div>
                    </td>
                    <td>{row.region?.name ?? "-"}</td>
                    <td>{row.organization?.name ?? "-"}</td>
                    <td>{statusPill(row.status)}</td>
                    <td className="text-muted">{formatDate(row.updatedAt)}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <Link className="icon-btn" href={`/drivers/${row.id}`} title="Detail"><Eye size={16} /></Link>
                        {hasPermission(user!, "master:manage") && <Link className="icon-btn" href={`/drivers/${row.id}/edit`} title="Edit"><MapPin size={16} /></Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Sebelumnya</button>
            <span className="pagination-info">Halaman {page} / {totalPages}</span>
            <button className="btn btn-ghost" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Selanjutnya</button>
          </div>
        )}
          </section>
        </div>
      </div>
    </section>
  </main>
);
}
