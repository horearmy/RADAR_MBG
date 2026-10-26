"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck } from "lucide-react";
import {
  getAuditLogs,
  getCurrentSession,
  hasPermission,
  type AuditLogSummary,
  type SessionUser,
} from "@/lib/api";

const PAGE_SIZE = 25;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function displayJson(value: unknown) {
  return value == null ? "—" : JSON.stringify(value, null, 2);
}

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const current = await getCurrentSession();
      if (!hasPermission(current, "audit:read")) {
        setUser(current);
        setLoading(false);
        return;
      }
      setUser(current);
      const result = await getAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(from ? { from: new Date(`${from}T00:00:00+07:00`).toISOString() } : {}),
        ...(to ? { to: new Date(`${to}T23:59:59.999+07:00`).toISOString() } : {}),
      });
      setLogs(result.data);
      setTotal(result.pagination.total);
    } catch (loadError: unknown) {
      if (loadError instanceof Error && loadError.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setError("Audit gagal dimuat. Periksa koneksi atau izin akun, lalu coba lagi.");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [action, entityType, from, page, router, search, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, reloadKey]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  if (loading && !user) {
    return <main className="session-state"><span className="session-spinner" /><p>Memuat audit…</p></main>;
  }
  if (!user) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>{error || "Sesi tidak dapat diverifikasi."}</p><button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button></main>;
  }
  if (!hasPermission(user, "audit:read")) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>Peran Anda tidak memiliki izin membaca audit.</p><Link className="session-retry" href="/">Kembali ke dashboard</Link></main>;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  return (
    <main className="audit-page">
      <header className="approval-topbar">
        <Link href="/" className="approval-back"><ArrowLeft size={15} /> Dashboard</Link>
        <div className="approval-brand"><span className="brand-mark"><span /><span /><span /></span><strong>RADAR<span>MBG</span></strong></div>
        <span className="approval-user">{user.displayName}</span>
      </header>
      <div className="audit-content">
        <div className="approval-heading">
          <div className="approval-heading-icon"><ShieldCheck size={19} /></div>
          <div><div className="eyebrow"><span className="eyebrow-line" />READ-ONLY · TERBATAS SCOPE</div><h1>Audit explorer</h1><p>Catatan SPPG, trip, exception, dan approval SPPG dalam scope akses Anda.</p></div>
          <button className="approval-refresh" onClick={() => setReloadKey((value) => value + 1)} type="button"><RefreshCw size={14} /> Muat ulang</button>
        </div>

        <form className="audit-filters panel" onSubmit={submitSearch}>
          <label className="audit-search"><span>Cari tindakan, entitas, ID, atau alasan</span><div><Search size={14} /><input maxLength={200} onChange={(event) => setSearchInput(event.target.value)} placeholder="Contoh: approval, trip, alasan…" value={searchInput} /></div></label>
          <label><span>Aksi</span><input maxLength={120} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="Semua aksi" value={action} /></label>
          <label><span>Jenis entitas</span><select onChange={(event) => { setEntityType(event.target.value); setPage(1); }} value={entityType}><option value="">Semua entitas</option><option value="sppg">SPPG</option><option value="trip">Trip</option><option value="exception_case">Exception</option><option value="approval_request">Permintaan approval</option></select></label>
          <label><span>Dari</span><input onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" value={from} /></label>
          <label><span>Sampai</span><input onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" value={to} /></label>
          <button className="approval-button approve" type="submit">Cari</button>
        </form>

        {error && <div className="approval-error" role="alert">{error}<button onClick={() => setReloadKey((value) => value + 1)} type="button">Coba lagi</button></div>}
        <div className="audit-list-heading"><div><h2>Riwayat tindakan</h2><p>{total.toLocaleString("id-ID")} catatan audit</p></div><span>Halaman {page}{totalPages ? ` dari ${totalPages}` : ""}</span></div>

        {loading ? <div className="approval-empty"><span className="session-spinner" /><span>Memuat catatan…</span></div> : logs.length ? (
          <div className="audit-list">
            {logs.map((log) => <article className="audit-card" key={log.id}>
              <div className="audit-card-main">
                <div><span className={`approval-status ${log.result === "success" ? "complete" : "pending"}`}><span />{log.result}</span><h3>{log.action}</h3><p>{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</p></div>
                <time>{formatDate(log.createdAt)}</time>
              </div>
              <div className="audit-meta"><span><small>Aktor</small><strong>{log.actor?.displayName ?? (log.actorUserId ? "Akun tidak tersedia" : "Sistem")}</strong></span><span><small>Request ID</small><strong>{log.requestId ?? "—"}</strong></span></div>
              {log.reason && <p className="audit-reason"><strong>Alasan:</strong> {log.reason}</p>}
              {(log.before != null || log.after != null) && <details className="audit-diff"><summary>Lihat before / after</summary><div><section><h4>Sebelum</h4><pre>{displayJson(log.before)}</pre></section><section><h4>Sesudah</h4><pre>{displayJson(log.after)}</pre></section></div></details>}
            </article>)}
          </div>
        ) : <div className="approval-empty"><ShieldCheck size={20} /><strong>{error ? "Audit belum tersedia" : "Tidak ada catatan audit"}</strong><span>{error ? "Gunakan tombol coba lagi setelah koneksi pulih." : "Coba ubah filter untuk melihat catatan lain."}</span></div>}

        <div className="audit-pagination"><span>Menampilkan {total ? ((page - 1) * PAGE_SIZE + 1).toLocaleString("id-ID") : 0}–{Math.min(page * PAGE_SIZE, total).toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")}</span><div><button aria-label="Halaman sebelumnya" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={15} /></button><button aria-label="Halaman selanjutnya" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={15} /></button></div></div>
      </div>
    </main>
  );
}
