"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Edit,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Truck,
  CheckCircle2,
  Wrench,
  Ban,
} from "lucide-react";
import { getCurrentSession, hasPermission, apiBaseUrl, type SessionUser } from "@/lib/api";

const apiBase = apiBaseUrl;

type Vehicle = {
  id: string;
  organizationId: string;
  sppgId: string;
  plateNumber: string;
  label?: string | null;
  capacity?: number | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  sppg?: { id: string; code: string; name: string };
  assignedDriver?: { id: string; code: string; name: string } | null;
};

type StatusFilter = "ALL" | "ACTIVE" | "MAINTENANCE" | "INACTIVE";

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
  if (s === "MAINTENANCE") return <span className="pill pill-warning">Perawatan</span>;
  if (s === "INACTIVE") return <span className="pill pill-neutral">Nonaktif</span>;
  return <span className="pill pill-neutral">{status}</span>;
}

export default function VehiclesPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [sppgs, setSppgs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sppgFilter, setSppgFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionRes, sppgRes] = await Promise.all([
        getCurrentSession().catch(() => null),
        fetch(`${apiBase}/admin/sppg?page=1&pageSize=200`, { credentials: "include", cache: "no-store" }),
      ]);
      if (sessionRes) setUser(sessionRes);
      if (sppgRes.ok) {
        const json = await sppgRes.json().catch(() => null);
        if (json) setSppgs(json.data ?? []);
      }

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (sppgFilter !== "ALL") params.set("sppgId", sppgFilter);
      const res = await fetch(`${apiBase}/admin/vehicles?${params.toString()}`, { credentials: "include", cache: "no-store" });
      const raw = await res.text();
      let json: { data?: Vehicle[]; pagination?: { totalPages?: number }; message?: string } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok || !json) throw new Error(json?.message ?? `Gagal memuat data kendaraan (HTTP ${res.status})`);
      setRows(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data kendaraan");
    } finally {
      setLoading(false);
    }
  }, [page, sppgFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status?.toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        row.plateNumber.toLowerCase().includes(q) ||
        row.label?.toLowerCase().includes(q) ||
        row.sppg?.name.toLowerCase().includes(q) ||
        row.sppg?.code.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const aktif = rows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length;
    const perawatan = rows.filter((r) => r.status?.toUpperCase() === "MAINTENANCE").length;
    const nonaktif = rows.filter((r) => r.status?.toUpperCase() === "INACTIVE").length;
    return { total, aktif, perawatan, nonaktif };
  }, [rows]);

  if (!loading && user && !hasPermission(user, "master:read")) {
    return (
      <main className="page">
        <header className="page-hero">
          <div className="page-hero-content">
            <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Kendaraan</p>
            <div className="page-hero-title-row">
              <div className="page-hero-icon"><Truck size={20} /></div>
              <div>
                <h1 className="page-title">Manajemen Kendaraan</h1>
                <p className="page-subtitle">Akses terbatas.</p>
              </div>
            </div>
          </div>
        </header>
        <div className="panel"><p className="text-secondary">Anda tidak memiliki izin untuk melihat halaman ini.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-hero">
        <div className="page-hero-content">
          <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Kendaraan</p>
          <div className="page-hero-title-row">
            <div className="page-hero-icon"><Truck size={20} /></div>
            <div>
              <h1 className="page-title">Manajemen Kendaraan</h1>
              <p className="page-subtitle">Kelola armada kendaraan per SPPG, status operasional, kapasitas, dan keterkaitan dengan driver.</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => load()} disabled={loading}>
            <RefreshCw size={16} /> Muat ulang
          </button>
          {hasPermission(user, "master:manage") && (
            <Link className="btn btn-primary" href="/vehicles/new">
              <Plus size={16} /> Tambah Kendaraan
            </Link>
          )}
        </div>
      </header>

      <section className="kpi-grid kpi-grid-4">
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-navy"><Truck size={18} /></div>
            <span className="kpi-label">Total Kendaraan</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.total}</div>
          </div>
          <p className="kpi-subtitle">Dalam lingkup akses</p>
        </article>
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-green"><CheckCircle2 size={18} /></div>
            <span className="kpi-label">Aktif</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.aktif}</div>
            <span className="kpi-trend-pill trend-up">Siap Operasi</span>
          </div>
          <p className="kpi-subtitle">Kendaraan siap bertugas</p>
        </article>
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-amber"><Wrench size={18} /></div>
            <span className="kpi-label">Dalam Perawatan</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.perawatan}</div>
            <span className="kpi-trend-pill trend-warn">Perawatan</span>
          </div>
          <p className="kpi-subtitle">Tidak tersedia untuk penugasan</p>
        </article>
        <article className="kpi-card kpi-card-enhanced">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-slate"><Ban size={18} /></div>
            <span className="kpi-label">Nonaktif</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value">{stats.nonaktif}</div>
          </div>
          <p className="kpi-subtitle">Dikeluarkan dari operasional</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="search-group">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari plat nomor, label, atau SPPG..." />
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
              <label>SPPG</label>
              <select value={sppgFilter} onChange={(e) => { setSppgFilter(e.target.value); setPage(1); }}>
                <option value="ALL">Semua SPPG</option>
                {sppgs.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <option value="ALL">Semua</option>
                <option value="ACTIVE">Aktif</option>
                <option value="MAINTENANCE">Perawatan</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>
            <button className="btn btn-ghost" onClick={() => { setSearch(""); setStatusFilter("ALL"); setSppgFilter("ALL"); setPage(1); }}>
              Reset Filter
            </button>
          </div>
        )}

        {loading && <div className="table-state">Memuat data kendaraan...</div>}
        {error && <div className="table-state error">{error}</div>}
        {!loading && !error && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plat Nomor</th>
                  <th>Kendaraan</th>
                  <th>SPPG</th>
                  <th>Kapasitas</th>
                  <th>Status</th>
                  <th>Diperbarui</th>
                  <th className="col-actions">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="empty-row">Tidak ada kendaraan</td></tr>}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td><span className="mono">{row.plateNumber}</span></td>
                    <td>
                      <div className="entity-cell">
                        <div className="entity-avatar"><Car size={16} /></div>
                        <div>
                          <p className="entity-name">{row.label || "Kendaraan"}</p>
                          <p className="entity-sub">ID: {row.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{row.sppg?.name ?? "-"}</span>
                        <span className="text-muted">{row.sppg?.code ?? row.sppgId}</span>
                      </div>
                    </td>
                    <td>{row.capacity ? `${row.capacity} porsi` : "-"}</td>
                    <td>{statusPill(row.status)}</td>
                    <td className="text-muted">{formatDate(row.updatedAt)}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <Link className="icon-btn" href={`/vehicles/${row.id}`} title="Detail"><Eye size={16} /></Link>
                        {hasPermission(user, "master:manage") && <Link className="icon-btn" href={`/vehicles/${row.id}/edit`} title="Edit"><Edit size={16} /></Link>}
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
    </main>
  );
}
