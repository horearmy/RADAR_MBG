"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Plus, RefreshCw, Truck, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, apiFetchUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

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
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/vehicles`, { credentials: "include" });
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
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "";
        if (message === "UNAUTHENTICATED" || message === "REQUEST_FAILED_403") {
          window.location.href = "/login";
          return;
        }
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
      const csrfRes = await apiFetchUrl(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/vehicles`, {
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
                <button className="trip-create-trigger" onClick={() => setShowForm(true)}>
                  <Plus size={14} />
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
            <div className="trip-modal-backdrop" onClick={() => !submitting && setShowForm(false)}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="add-vehicle-title">
                <button className="trip-modal-close" onClick={() => setShowForm(false)} disabled={submitting} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h2 id="add-vehicle-title">Tambah kendaraan baru</h2>
                    <p>Isi data kendaraan operasional untuk tenant ini.</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
                          <path d="M15 18H9"></path>
                          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path>
                          <circle cx="17" cy="18" r="2"></circle>
                          <circle cx="7" cy="18" r="2"></circle>
                        </svg>
                        Plat nomor
                      </span>
                      <input type="text" value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} placeholder="B 1234 ABC" required />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        Label (opsional)
                      </span>
                      <input type="text" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Nama/label kendaraan" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        Kapasitas (porsi)
                      </span>
                      <input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="0" min="0" />
                      <small>Kapasitas maksimal per perjalanan</small>
                    </div>
                  </div>
                  {formError && (
                    <div className="trip-modal-error" role="alert">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      <span>{formError}</span>
                    </div>
                  )}
                  <div className="trip-action-buttons">
                    <button type="button" className="trip-action-button muted" onClick={() => setShowForm(false)} disabled={submitting}>
                      Batal
                    </button>
                    <button type="submit" className="trip-action-button primary" disabled={submitting || !form.plateNumber}>
                      {submitting ? "Menyimpan..." : "Simpan kendaraan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
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
