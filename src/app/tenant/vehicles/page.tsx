"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Plus, RefreshCw, Truck, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type Vehicle = { id: string; plateNumber: string; label?: string; capacity?: number; status: string };

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk menambah kendaraan.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    default:
      return "Kendaraan gagal ditambahkan. Periksa data lalu coba lagi.";
  }
}

export default function TenantVehiclesPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ plateNumber: "", label: "", capacity: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadVehicles = async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/vehicles`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat kendaraan");
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : data.data ?? []);
      setSessionState("ready");
      setRefreshError(null);
    } catch {
      if (silent) setRefreshError("Pembaruan gagal. Data terakhir tetap ditampilkan.");
      else setSessionState("data-error");
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await getCurrentSession();
        if (!active) return;
        setSessionUser(user);
        await loadVehicles(false);
      } catch {
        if (!active) return;
        setSessionState("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  const handleRefresh = async (silent = true) => {
    setRefreshing(true);
    try { await loadVehicles(silent); } finally { setRefreshing(false); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/vehicles`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          plateNumber: form.plateNumber.trim().toUpperCase(),
          label: form.label.trim() || undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setShowForm(false);
      setForm({ plateNumber: "", label: "", capacity: "" });
      await loadVehicles(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat kendaraan…</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canCreateVehicle = hasPermission(sessionUser, "master:manage");

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Kendaraan</strong></div>
          <div className="topbar-actions">
            <span className="environment"><span className="live-dot" />DATA OPERASIONAL</span>
            <span className="topbar-divider" />
            <HeaderAccount user={sessionUser} />
          </div>
        </header>
        <main className="content-area dashboard-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()).toUpperCase()}</div>
              <h1>Kendaraan Tenant</h1>
              <p>Kendaraan operasional SPPG.</p>
            </div>
            <div className="page-heading-actions">
              {canCreateVehicle && (
                <button className="export-button" onClick={() => setShowForm(true)}>
                  <Plus size={15} />
                  Tambah kendaraan
                </button>
              )}
              <button className="export-button" onClick={() => void handleRefresh(true)} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
                {refreshing ? "Memuat…" : "Muat ulang"}
              </button>
            </div>
          </div>

          {refreshError && <p className="refresh-warning" role="status">{refreshError}</p>}

          {/* KPI Cards */}
          <section className="kpi-grid kpi-grid-4" aria-label="Ringkasan kendaraan" style={{ marginBottom: "1rem" }}>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-blue"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Total</span></div>
              <p className="kpi-label">Total Kendaraan</p>
              <div className="kpi-value">{vehicles.length} <span>unit</span></div>
              <div className="kpi-foot">Terdaftar</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-green"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
              <p className="kpi-label">Kendaraan Aktif</p>
              <div className="kpi-value">{vehicles.filter((v) => v.status === "ACTIVE").length} <span>unit</span></div>
              <div className="kpi-foot">Siap digunakan</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-navy"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Nonaktif</span></div>
              <p className="kpi-label">Nonaktif / Suspend</p>
              <div className="kpi-value">{vehicles.filter((v) => v.status !== "ACTIVE").length} <span>unit</span></div>
              <div className="kpi-foot">Tidak aktif</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-amber"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Kapasitas</span></div>
              <p className="kpi-label">Total Kapasitas</p>
              <div className="kpi-value">{vehicles.reduce((sum, v) => sum + (v.capacity ?? 0), 0)} <span>porsi</span></div>
              <div className="kpi-foot">Gabungan semua kendaraan</div>
            </article>
          </section>

          {/* Add Vehicle Form */}
          {showForm && (
            <section className="panel" aria-label="Tambah kendaraan">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Tambah kendaraan</h2></div>
                  <p>Isi data kendaraan baru.</p>
                </div>
                <button className="square-button" onClick={() => setShowForm(false)} aria-label="Tutup form"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit} className="trip-form">
                <div className="form-grid">
                  <label>
                    <span>Plat nomor</span>
                    <input type="text" value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} placeholder="B 1234 ABC" required />
                  </label>
                  <label>
                    <span>Label (opsional)</span>
                    <input type="text" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Nama/label kendaraan" />
                  </label>
                  <label>
                    <span>Kapasitas (porsi)</span>
                    <input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="0" min="0" />
                  </label>
                </div>
                {formError && <p className="refresh-warning" role="alert">{formError}</p>}
                <div className="page-heading-actions">
                  <button type="button" className="export-button" onClick={() => setShowForm(false)} disabled={submitting}>Batal</button>
                  <button type="submit" className="export-button" disabled={submitting || !form.plateNumber}>
                    {submitting ? "Menyimpan…" : "Simpan kendaraan"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Vehicles Table */}
          <section className="panel" aria-label="Daftar kendaraan">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Kendaraan terdaftar</h2><span className="count-chip">{vehicles.length}</span></div>
                <p>Kendaraan operasional tenant.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>PLAT</th><th>LABEL</th><th>KAPASITAS</th><th>STATUS</th></tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td>{v.plateNumber}</td>
                      <td>{v.label ?? "—"}</td>
                      <td>{v.capacity ?? "—"}</td>
                      <td>{v.status}</td>
                    </tr>
                  ))}
                  {!vehicles.length && <tr><td colSpan={4} className="table-empty">Belum ada kendaraan.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> {vehicles.length} kendaraan</span>
          </footer>
        </main>
      </section>
    </div>
  );
}