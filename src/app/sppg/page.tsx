"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  Command,
  Eye,
  Filter,
  LogOut,
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
  driverCount?: number;
  vehicleCount?: number;
  distributionToday?: number;
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
  if (s === "PENDING") return <span className="pill pill-warning">Pending</span>;
  if (s === "SUSPENDED") return <span className="pill pill-warning">Ditangguhkan</span>;
  if (s === "INACTIVE") return <span className="pill pill-neutral">Nonaktif</span>;
  if (s === "ARCHIVED") return <span className="pill pill-neutral">Arsip</span>;
  return <span className="pill pill-neutral">{status}</span>;
}

export default function SppgPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Sppg[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [provisionResult, setProvisionResult] = useState<any>(null);
  const [alreadyMsg, setAlreadyMsg] = useState<string | null>(null);

  async function loadRegistrations() {
    try {
      const res = await fetch(`${apiBase}/public/sppg-registrations`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) setRegistrations(await res.json());
    } catch {}
  }

  async function regAction(id: string, action: 'approve' | 'reject' | 'request-revision' | 'provision') {
    const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' });
    const csrfJson = await csrfRes.json();
    const url = action === 'provision'
      ? `${apiBase}/public/sppg-registrations/${id}/provision`
      : `${apiBase}/public/sppg-registrations/${id}/${action}`;
    const method = action === 'provision' ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfJson.csrfToken },
      body: action === 'provision' ? undefined : JSON.stringify({ approverId: user?.id ?? 'admin', notes: 'review' }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      alert(body?.message ?? 'Gagal memproses pendaftaran');
      return;
    }
    if (body?.alreadyProvisioned) {
      setAlreadyMsg('Pendaftaran ini sudah diprovisi sebelumnya.');
    } else if (action === 'provision') {
      setProvisionResult(body);
    }
    await loadRegistrations();
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionRes = await getCurrentSession().catch(() => null);
      if (sessionRes) setUser(sessionRes);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`${apiBase}/admin/sppg?${params.toString()}`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal memuat data SPPG");
      setRows(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      void loadRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data SPPG");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.address?.toLowerCase().includes(q) ||
        row.region?.name.toLowerCase().includes(q) ||
        row.region?.code.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const aktif = rows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length;
    const perhatian = rows.filter((r) => r.status?.toUpperCase() === "PENDING" || r.status?.toUpperCase() === "SUSPENDED").length;
    const nonaktif = rows.filter((r) => r.status?.toUpperCase() === "INACTIVE" || r.status?.toUpperCase() === "ARCHIVED").length;
    const distribusi = rows.reduce((sum, r) => sum + (r.distributionToday ?? 0), 0);
    return { total, aktif, perhatian, nonaktif, distribusi };
  }, [rows]);

  if (!user) return <main className="page"><p>Memuat...</p></main>;
  if (user && !hasPermission(user, "master:read") && !hasPermission(user, "sppg:read")) {
    return (
      <main className="app-shell">
        <aside className="sidebar">
          <Link className="brand" href="/" aria-label="RADAR MBG beranda">
            <span className="brand-mark"><span /><span /><span /></span>
            <span className="brand-copy"><strong>RADAR<span>MBG</span></strong><small>Operational intelligence</small></span>
          </Link>
        </aside>
        <section className="main-column">
          <header className="topbar">
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>SPPG</strong></div>
          </header>
          <div className="content-area">
            <div className="page">
              <header className="page-hero">
                <div>
                  <p className="page-breadcrumb">Operasional &gt; SPPG</p>
                  <h1 className="page-title">Manajemen SPPG</h1>
                  <p className="page-subtitle">Akses terbatas.</p>
                </div>
              </header>
              <div className="panel"><p className="text-secondary">Anda tidak memiliki izin untuk melihat halaman ini.</p></div>
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
          <Link className="nav-item nav-link nav-active" href="/sppg"><Utensils size={17} strokeWidth={1.8} /><span>SPPG</span></Link>
          <Link className="nav-item nav-link" href="/drivers"><Users size={17} strokeWidth={1.8} /><span>Driver</span></Link>
          <Link className="nav-item nav-link" href="/vehicles"><Truck size={17} strokeWidth={1.8} /><span>Kendaraan</span></Link>
          {hasPermission(user, "audit:read") && <Link className="nav-item nav-link" href="/audit"><Activity size={17} strokeWidth={1.8} /><span>Audit explorer</span></Link>}
          {hasPermission(user, "admin:manage_users") && <Link className="nav-item nav-link" href="/users"><Users size={17} strokeWidth={1.8} /><span>Administrasi akun</span></Link>}
          {(hasPermission(user, "geofence:read") || hasPermission(user, "geofence:manage")) && <Link className="nav-item nav-link" href="/geofences"><MapPinned size={17} strokeWidth={1.8} /><span>Geofence</span></Link>}
          {user?.mfaEnabled === false && <Link className="nav-item nav-link" href="/security/mfa"><ShieldCheck size={17} strokeWidth={1.8} /><span>Daftarkan MFA</span></Link>}
          {(hasPermission(user, "sppg:manage") || hasPermission(user, "approval:review")) && <Link className="nav-item nav-link" href="/approvals"><ClipboardCheck size={17} strokeWidth={1.8} /><span>Persetujuan</span></Link>}
          {hasPermission(user, "trip:start") && hasPermission(user, "trip:location:update") && (
            <>
              <p className="nav-caption nav-caption-spaced">PENGEMUDI</p>
              <Link className="nav-item nav-link" href="/driver"><Navigation size={17} strokeWidth={1.8} /><span>Mode pengemudi</span></Link>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><div className="help-icon"><Activity size={17} /></div><div><strong>Data operasional</strong><span>Terhubung ke API RADAR MBG</span></div></div>
        </div>
      </aside>
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>SPPG</strong></div>
          <div className="topbar-actions"><span className="environment"><span className="live-dot" />DATA OPERASIONAL</span><span className="date-button"><Clock3 size={15} />Hari ini</span></div>
        </header>
        <div className="content-area">
          <div className="page">
            <header className="page-hero">
              <div>
                <p className="page-breadcrumb">Operasional &gt; SPPG</p>
                <div className="page-hero-title-row">
                  <div className="page-hero-icon"><Utensils size={20} /></div>
                  <div>
                    <h1 className="page-title">Manajemen SPPG</h1>
                    <p className="page-subtitle">Kelola profil, lokasi, status operasional, dan aktivitas distribusi setiap SPPG.</p>
                  </div>
                </div>
              </div>
              <div className="page-actions">
                <button className="btn btn-ghost" onClick={() => load()} disabled={loading}>
                  <RefreshCw size={16} /> Muat ulang
                </button>
                {hasPermission(user, "master:manage") && (
                  <Link className="btn btn-primary" href="/sppg/new">
                    <Plus size={16} /> Tambah SPPG
                  </Link>
                )}
              </div>
            </header>

            <section className="kpi-grid kpi-grid-5">
              <article className="kpi-card kpi-card-enhanced">
                <div className="kpi-header">
                  <div className="kpi-icon-wrap kpi-icon-navy"><Building2 size={18} /></div>
                  <span className="kpi-label">Total SPPG</span>
                </div>
                <div className="kpi-value-row">
                  <div className="kpi-value">{stats.total}</div>
                </div>
                <p className="kpi-subtitle">Jumlah unit sesuai lingkup akses</p>
              </article>
              <article className="kpi-card kpi-card-enhanced">
                <div className="kpi-header">
                  <div className="kpi-icon-wrap kpi-icon-green"><Utensils size={18} /></div>
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
                  <div className="kpi-icon-wrap kpi-icon-slate"><Building2 size={18} /></div>
                  <span className="kpi-label">Nonaktif</span>
                </div>
                <div className="kpi-value-row">
                  <div className="kpi-value">{stats.nonaktif}</div>
                </div>
                <p className="kpi-subtitle">Tidak beroperasi saat ini</p>
              </article>
              <article className="kpi-card kpi-card-enhanced">
                <div className="kpi-header">
                  <div className="kpi-icon-wrap kpi-icon-blue"><Truck size={18} /></div>
                  <span className="kpi-label">Distribusi Hari Ini</span>
                </div>
                <div className="kpi-value-row">
                  <div className="kpi-value">{stats.distribusi}</div>
                </div>
                <p className="kpi-subtitle">Distribusi pada hari berjalan</p>
              </article>
            </section>

            <section className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <div>
                  <h2>Pendaftaran SPPG (Menunggu Review)</h2>
                  <p>{registrations.filter((r) => r.status === 'SUBMITTED').length} baru</p>
                </div>
              </div>
              <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>NOMOR</th><th>NAMA</th><th>STATUS</th><th>AKSI</th></tr></thead>
                  <tbody>
                    {registrations.map((r) => (
                      <tr key={r.id} style={{ background: r.status === 'APPROVED' ? '#e8f7f0' : r.status === 'REJECTED' ? '#fff0ef' : undefined }}>
                        <td>{r.registrationNumber}</td>
                        <td>{r.sppgName}</td>
                        <td><span className={`pill ${r.status === 'APPROVED' ? 'pill-active' : r.status === 'REJECTED' ? 'pill-danger' : r.status === 'REVISION_REQUIRED' ? 'pill-warning' : 'pill-info'}`}>{r.status}</span></td>
                        <td className="space-x-2">
                          <button className="btn btn-ghost" onClick={() => setSelectedReg(r)}>Detail</button>
                          <button className="btn btn-primary" onClick={() => regAction(r.id, 'approve')}>Setujui</button>
                          <button className="btn btn-danger" onClick={() => regAction(r.id, 'reject')}>Tolak</button>
                          <button className="btn btn-warning" onClick={() => regAction(r.id, 'request-revision')}>Revisi</button>
                          {r.status === 'APPROVED' && <button className="btn btn-success" onClick={() => regAction(r.id, 'provision')}>Provision</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}>
                      <option value="ALL">Semua</option>
                      <option value="ACTIVE">Aktif</option>
                      <option value="PENDING">Pending</option>
                      <option value="SUSPENDED">Ditangguhkan</option>
                      <option value="INACTIVE">Nonaktif</option>
                      <option value="ARCHIVED">Arsip</option>
                    </select>
                  </div>
                  <button className="btn btn-ghost" onClick={() => { setSearch(""); setStatusFilter("ALL"); setPage(1); }}>
                    Reset Filter
                  </button>
                </div>
              )}

              {loading && <div className="table-state">Memuat data SPPG...</div>}
              {error && <div className="table-state error">{error}</div>}
              {!loading && !error && (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode SPPG</th>
                        <th>Nama SPPG</th>
                        <th>Lokasi</th>
                        <th>Penanggung Jawab</th>
                        <th>Driver</th>
                        <th>Kendaraan</th>
                        <th>Distribusi Hari Ini</th>
                        <th>Status</th>
                        <th>Diperbarui</th>
                        <th className="col-actions">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && <tr><td colSpan={10} className="empty-row">Tidak ada SPPG</td></tr>}
                      {filtered.map((row) => (
                        <tr key={row.id}>
                          <td><span className="mono">{row.code}</span></td>
                          <td>
                            <div className="entity-cell">
                              <div className="entity-avatar"><Utensils size={16} /></div>
                              <div>
                                <p className="entity-name">{row.name}</p>
                                <p className="entity-sub">ID: {row.id.slice(0, 8).toUpperCase()}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="cell-stack">
                              <span>{row.address ?? "-"}</span>
                              <span className="text-muted">{row.region?.name ?? row.region?.code ?? "-"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="cell-stack">
                              <span>{row.organization?.name ?? "-"}</span>
                              <span className="text-muted">{row.organization?.code ?? "-"}</span>
                            </div>
                          </td>
                          <td>{row.driverCount ?? 0}</td>
                          <td>{row.vehicleCount ?? 0}</td>
                          <td>{row.distributionToday ?? 0}</td>
                          <td>{statusPill(row.status)}</td>
                          <td className="text-muted">{formatDate(row.updatedAt)}</td>
                          <td className="col-actions">
                            <div className="row-actions">
                              <Link className="icon-btn" href={`/sppg/${row.id}`} title="Detail"><Eye size={16} /></Link>
                              {hasPermission(user, "master:manage") && <Link className="icon-btn" href={`/sppg/${row.id}/edit`} title="Edit"><Settings2 size={16} /></Link>}
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

    {provisionResult && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,27,58,.45)', backdropFilter: 'blur(6px)', zIndex: 50 }}>
        <div className="modal" style={{ width: 'min(560px, 92vw)', borderRadius: 14, background: '#fff', padding: 0, boxShadow: '0 24px 60px rgba(7,27,58,.25)', overflow: 'hidden' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>Provisioning Berhasil</h2>
            <p style={{ margin: '4px 0 0', color: '#62728a', fontSize: 12 }}>Tenant dan undangan aktivasi telah dibuat.</p>
          </div>
          <div style={{ padding: 20, display: 'grid', gap: 8, fontSize: 13 }}>
            <div><strong>Tenant ID:</strong> {provisionResult.tenant?.id}</div>
            <div><strong>Nama SPPG:</strong> {provisionResult.tenant?.name}</div>
            <div><strong>Admin:</strong> {provisionResult.tenant?.tenantCode}</div>
            <div><strong>Kanal:</strong> Email (dev: log)</div>
            <div><strong>Pengiriman:</strong> SENT (dev)</div>
            <div><strong>Kedaluwarsa:</strong> 24 jam</div>
            <div><strong>Status tenant:</strong> {provisionResult.tenant?.status}</div>
            <div><strong>Status akun:</strong> INVITED</div>
            <div style={{ marginTop: 8, color: '#62728a', fontSize: 11 }}>Token dibuat oleh server, disimpan sebagai hash, dan hanya dapat digunakan satu kali.</div>
          </div>
          <div style={{ padding: 20, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setProvisionResult(null)}>Tutup</button>
            <button className="btn btn-primary" onClick={() => setProvisionResult(null)}>Lihat Detail Tenant</button>
          </div>
        </div>
      </div>
    )}

    {alreadyMsg && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,27,58,.45)', backdropFilter: 'blur(6px)', zIndex: 50 }}>
        <div className="modal" style={{ width: 'min(480px, 92vw)', borderRadius: 14, background: '#fff', padding: 20, boxShadow: '0 24px 60px rgba(7,27,58,.25)' }}>
          <h2 style={{ marginTop: 0 }}>Sudah Diprovisi</h2>
          <p>{alreadyMsg}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => setAlreadyMsg(null)}>Tutup</button>
          </div>
        </div>
      </div>
    )}

    {selectedReg && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,27,58,.45)', backdropFilter: 'blur(6px)', zIndex: 50 }}>
        <div className="modal" style={{ width: 'min(640px, 92vw)', borderRadius: 14, background: '#fff', padding: 0, boxShadow: '0 24px 60px rgba(7,27,58,.25)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>Detail Pendaftaran</h2>
            <button onClick={() => setSelectedReg(null)} style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 18 }}>X</button>
          </div>
          <div style={{ padding: 20, display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
            <div><strong>Nomor:</strong> {selectedReg.registrationNumber}</div>
            <div><strong>Status:</strong> {selectedReg.status}</div>
            <div><strong>Nama SPPG:</strong> {selectedReg.sppgName}</div>
            <div><strong>Kode Resmi:</strong> {selectedReg.officialCode ?? '-'}</div>
            <div><strong>Wilayah:</strong> {selectedReg.provinceCode}/{selectedReg.regencyCode}/{selectedReg.districtCode}/{selectedReg.villageCode}</div>
            <div><strong>Alamat:</strong> {selectedReg.fullAddress}</div>
            <div><strong>PIC:</strong> {selectedReg.contactName}</div>
            <div><strong>Email:</strong> {selectedReg.contactEmail}</div>
            <div><strong>Telepon:</strong> {selectedReg.contactPhone}</div>
            <div><strong>Submitted:</strong> {selectedReg.submittedAt}</div>
            <div><strong>Reviewed:</strong> {selectedReg.reviewedAt ?? '-'}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Catatan:</strong> {selectedReg.reviewNotes ?? '-'}</div>
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { regAction(selectedReg.id, 'approve'); setSelectedReg(null); }}>Setujui</button>
            <button className="btn btn-danger" onClick={() => { regAction(selectedReg.id, 'reject'); setSelectedReg(null); }}>Tolak</button>
            <button className="btn btn-warning" onClick={() => { regAction(selectedReg.id, 'request-revision'); setSelectedReg(null); }}>Revisi</button>
            {selectedReg.status === 'APPROVED' && <button className="btn btn-success" onClick={() => { regAction(selectedReg.id, 'provision'); setSelectedReg(null); }}>Provision</button>}
            <button className="btn btn-ghost" onClick={() => setSelectedReg(null)}>Tutup</button>
          </div>
        </div>
      </div>
    )}

    </main>
  );
}