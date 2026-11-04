"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, RefreshCw, Search, ShieldAlert, Truck, UserRound, Users, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { DriverCard } from "@/app/drivers/DriverCard";
import { getCurrentSession, hasPermission, hasPlatformPermission, apiBaseUrl, apiFetchUrl, type SessionUser } from "@/lib/api";

const apiBase = apiBaseUrl;

type DriverRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  region?: { name: string } | null;
  organization?: { name: string } | null;
  sppg?: { id: string; code: string; name: string } | null;
  tenant?: { id: string; tenantCode: string; name: string } | null;
  updatedAt: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";

type DriverResponse = {
  data?: DriverRow[];
  pagination?: { total: number; totalPages: number };
  message?: string;
};

type DriverSummary = { total: number; active: number; suspended: number; inactive: number };

export default function DriversPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<DriverSummary>({ total: 0, active: 0, suspended: 0, inactive: 0 });
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession();
      setUser(session);
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const [response, summaryResponse] = await Promise.all([
        apiFetchUrl(`${apiBase}/admin/drivers?${params}`, { credentials: "include", cache: "no-store" }),
        apiFetchUrl(`${apiBase}/admin/drivers/summary`, { credentials: "include", cache: "no-store" }),
      ]);
      const body = await response.json().catch(() => null) as DriverResponse | null;
      const summaryBody = await summaryResponse.json().catch(() => null) as DriverSummary | null;
      if (!response.ok || !body) {
        if (response.status === 401) throw new Error("Sesi Anda telah berakhir. Silakan masuk kembali.");
        if (response.status === 403) throw new Error("Anda tidak memiliki izin untuk melihat direktori driver.");
        throw new Error(body?.message ?? `Gagal memuat driver (HTTP ${response.status}).`);
      }
      setRows(body.data ?? []);
      setTotal(body.pagination?.total ?? body.data?.length ?? 0);
      setTotalPages(Math.max(1, body.pagination?.totalPages ?? 1));
      if (summaryResponse.ok && summaryBody) setSummary(summaryBody);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat data driver.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return rows.filter((row) => {
      if (!query) return true;
      return [row.name, row.code, row.phone, row.sppg?.name, row.sppg?.code, row.tenant?.name, row.tenant?.tenantCode]
        .some((value) => value?.toLocaleLowerCase("id-ID").includes(query));
    });
  }, [rows, search]);

  const stats = summary;

  const canRead = user ? hasPlatformPermission(user, "master:read") || hasPermission(user, "master:read") : false;
  const canManage = user ? hasPermission(user, "master:manage") : false;
  const canAdd = canManage;
  const chips: Array<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: "Semua" },
    { value: "ACTIVE", label: "Aktif" },
    { value: "SUSPENDED", label: "Perhatian" },
    { value: "INACTIVE", label: "Nonaktif" },
  ];

  if (!loading && user && !canRead) {
    return <main className="page"><header className="page-header"><div><p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Driver</p><h1 className="page-title">Manajemen Driver</h1></div></header><div className="panel"><p className="text-secondary">Anda tidak memiliki izin untuk melihat data driver.</p></div></main>;
  }

  return (
    <main className="page drivers-page">
      <header className="drivers-hero">
        <div className="drivers-hero-copy">
          <p className="page-breadcrumb">Operasional <span>/</span> Manajemen <span>/</span> Driver</p>
          <div className="drivers-title-row">
            <div className="drivers-title-icon"><Users size={21} /></div>
            <div><h1>Direktori Driver</h1><p>Telusuri driver dari seluruh tenant dan buka profil operasionalnya.</p></div>
          </div>
        </div>
        <div className="drivers-hero-actions">
          <button className="drivers-refresh" onClick={() => void load()} disabled={loading} aria-label="Muat ulang data"><RefreshCw size={16} className={loading ? "drivers-spinning" : ""} /><span>Muat ulang</span></button>
          {canAdd && <Link className="drivers-add" href="/drivers/new"><Plus size={17} /><span>Tambah driver</span></Link>}
        </div>
      </header>

      <section className="drivers-stats" aria-label="Ringkasan driver">
        <article className="drivers-stat"><span className="drivers-stat-icon drivers-stat-blue"><Users size={17} /></span><div><span>Total driver</span><strong>{stats.total}</strong><small>Seluruh tenant</small></div></article>
        <article className="drivers-stat"><span className="drivers-stat-icon drivers-stat-green"><CheckCircle2 size={17} /></span><div><span>Aktif</span><strong>{stats.active}</strong><small>Siap bertugas</small></div></article>
        <article className="drivers-stat"><span className="drivers-stat-icon drivers-stat-amber"><ShieldAlert size={17} /></span><div><span>Perhatian</span><strong>{stats.suspended}</strong><small>Ditangguhkan</small></div></article>
        <article className="drivers-stat"><span className="drivers-stat-icon drivers-stat-slate"><Ban size={17} /></span><div><span>Nonaktif</span><strong>{stats.inactive}</strong><small>Tidak beroperasi</small></div></article>
      </section>

      <section className="drivers-panel">
        <div className="drivers-panel-heading"><div><h2>Semua driver</h2><p>{total.toLocaleString("id-ID")} profil lintas tenant</p></div><span className="drivers-page-count">{filteredRows.length} ditampilkan</span></div>
        <div className="drivers-toolbar">
          <label className="drivers-search"><Search size={17} /><input aria-label="Cari driver" placeholder="Cari nama, kode, nomor telepon…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><kbd>/</kbd></label>
          <div className="drivers-filters" role="group" aria-label="Filter status driver">
            {chips.map((chip) => <button key={chip.value} type="button" className={`drivers-filter${statusFilter === chip.value ? " is-selected" : ""}`} aria-pressed={statusFilter === chip.value} onClick={() => { setStatusFilter(chip.value); setPage(1); }}>{chip.label}{chip.value === "ALL" && <span>{total}</span>}</button>)}
          </div>
        </div>

        {error && <div className="drivers-error" role="alert"><span>{error}</span><button onClick={() => void load()}>Coba lagi</button></div>}
        {loading && <div className="drivers-loading" role="status"><span className="session-spinner" />Memuat daftar driver…</div>}
        {!loading && !error && filteredRows.length === 0 && <div className="drivers-empty"><span className="drivers-empty-icon"><UserRound size={22} /></span><h3>{rows.length ? "Driver tidak ditemukan" : "Belum ada driver"}</h3><p>{rows.length ? "Coba kata kunci atau status yang berbeda." : "Driver akan muncul di sini setelah terdaftar pada tenant."}</p>{!rows.length && canAdd && <Link className="drivers-add" href="/drivers/new"><Plus size={17} />Tambah driver</Link>}</div>}
        {!loading && !error && filteredRows.length > 0 && <div className="drivers-list">{filteredRows.map((row) => <DriverCard key={row.id} row={row} onView={(id) => router.push(`/drivers/${id}`)} hasManagePermission={canManage} />)}</div>}

        {!loading && !error && totalPages > 1 && <div className="drivers-pagination"><span>Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong></span><div><button aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} />Sebelumnya</button><button aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Berikutnya<ChevronRight size={17} /></button></div></div>}
      </section>
      <nav className="drivers-mobile-nav" aria-label="Navigasi cepat"><Link href="/"><UserRound size={17} /><span>Beranda</span></Link><Link href="/drivers" aria-current="page"><Users size={17} /><span>Driver</span></Link><Link href="/vehicles"><Truck size={17} /><span>Kendaraan</span></Link></nav>
    </main>
  );
}
