"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, Plus, RefreshCw, UserRound, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type Driver = { id: string; code: string; name: string; phone?: string; status: string };

type InviteResult = {
  user: { id: string; username: string; displayName: string };
  membership: { id: string; role: string; status: string };
  invitationToken: string;
};

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk menambah driver.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    default:
      return "Driver gagal ditambahkan. Periksa data lalu coba lagi.";
  }
}

export default function TenantDriversPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Invite driver account state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ username: "", displayName: "", driverId: "" });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

  const loadDrivers = async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/drivers`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat driver");
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : data.data ?? []);
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
        await loadDrivers(false);
      } catch {
        if (!active) return;
        setSessionState("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  const handleRefresh = async (silent = true) => {
    setRefreshing(true);
    try { await loadDrivers(silent); } finally { setRefreshing(false); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/drivers`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setShowForm(false);
      setForm({ code: "", name: "", phone: "" });
      await loadDrivers(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteDriver = async (e: FormEvent) => {
    e.preventDefault();
    setInviteSubmitting(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/invitations`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          username: inviteForm.username.trim(),
          displayName: inviteForm.displayName.trim() || inviteForm.username.trim(),
          role: "TENANT_DRIVER",
          driverId: inviteForm.driverId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      const result = await res.json();
      setInviteResult(result);
      setShowInviteForm(false);
      setInviteForm({ username: "", displayName: "", driverId: "" });
      await loadDrivers(true);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Gagal mengundang driver");
    } finally {
      setInviteSubmitting(false);
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat driver…</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canCreateDriver = hasPermission(sessionUser, "master:manage");
  const canInviteDriver = hasPermission(sessionUser, "admin:manage_users");

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Driver</strong></div>
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
              <h1>Driver Tenant</h1>
              <p>Pengemudi operasional SPPG. Buat akun login agar driver bisa masuk ke field app.</p>
            </div>
            <div className="page-heading-actions">
              {canCreateDriver && (
                <button className="export-button" onClick={() => {
                  const code = `DRV-${Date.now().toString(36).toUpperCase()}`;
                  setForm({ code, name: "", phone: "" });
                  setShowForm(true);
                }}>
                  <Plus size={15} />
                  Tambah driver
                </button>
              )}
              {canInviteDriver && (
                <button className="export-button" onClick={() => setShowInviteForm(true)}>
                  <KeyRound size={15} />
                  Buat akun login
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
          <section className="kpi-grid kpi-grid-4" aria-label="Ringkasan driver" style={{ marginBottom: "1rem" }}>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-blue"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Total</span></div>
              <p className="kpi-label">Total Driver</p>
              <div className="kpi-value">{drivers.length} <span>driver</span></div>
              <div className="kpi-foot">Terdaftar</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-green"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
              <p className="kpi-label">Driver Aktif</p>
              <div className="kpi-value">{drivers.filter((d) => d.status === "ACTIVE").length} <span>driver</span></div>
              <div className="kpi-foot">Siap bertugas</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-navy"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Suspend</span></div>
              <p className="kpi-label">Suspend / Nonaktif</p>
              <div className="kpi-value">{drivers.filter((d) => d.status !== "ACTIVE").length} <span>driver</span></div>
              <div className="kpi-foot">Tidak aktif</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-amber"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Telepon</span></div>
              <p className="kpi-label">Dengan Telepon</p>
              <div className="kpi-value">{drivers.filter((d) => d.phone).length} <span>driver</span></div>
              <div className="kpi-foot">Kontak tersedia</div>
            </article>
          </section>

          {/* Invitation Token Result */}
          {inviteResult && (
            <section className="panel" aria-label="Token undangan" style={{ marginBottom: "1rem", border: "2px solid #22c55e" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Akun Driver Berhasil Dibuat</h2></div>
                  <p>Kirim token berikut ke driver untuk aktivasi akun (set password).</p>
                </div>
                <button className="square-button" onClick={() => setInviteResult(null)} aria-label="Tutup"><X size={16} /></button>
              </div>
              <div style={{ padding: "1rem" }}>
                <p><strong>Username:</strong> {inviteResult.user.username}</p>
                <p><strong>Nama:</strong> {inviteResult.user.displayName}</p>
                <p><strong>Role:</strong> {inviteResult.membership.role}</p>
                <p><strong>Token Aktivasi:</strong></p>
                <code style={{ display: "block", padding: "0.5rem", background: "#f1f5f9", borderRadius: "4px", wordBreak: "break-all", fontSize: "0.85rem" }}>
                  {inviteResult.invitationToken}
                </code>
                <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                  Token berlaku 7 hari. Driver mengaktifkan akun di <strong>/account-access</strong> dengan token ini + password baru (min 14 karakter).
                  Setelah aktivasi, driver bisa login ke field app dengan username + password.
                </p>
              </div>
            </section>
          )}

          {/* Invite Driver Form */}
          {showInviteForm && (
            <section className="panel" aria-label="Buat akun login driver">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Buat akun login driver</h2></div>
                  <p>Buat akun untuk driver agar bisa masuk ke field app.</p>
                </div>
                <button className="square-button" onClick={() => setShowInviteForm(false)} aria-label="Tutup form"><X size={16} /></button>
              </div>
              <form onSubmit={handleInviteDriver} className="trip-form">
                <div className="form-grid">
                  <label>
                    <span>Username</span>
                    <input type="text" value={inviteForm.username} onChange={(e) => setInviteForm((f) => ({ ...f, username: e.target.value }))} placeholder="username driver" required />
                  </label>
                  <label>
                    <span>Nama tampilan</span>
                    <input type="text" value={inviteForm.displayName} onChange={(e) => setInviteForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Nama driver" />
                  </label>
                  <label>
                    <span>Link ke Driver (opsional)</span>
                    <select value={inviteForm.driverId} onChange={(e) => setInviteForm((f) => ({ ...f, driverId: e.target.value }))}>
                      <option value="">Tidak link ke driver</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                    </select>
                  </label>
                </div>
                {inviteError && <p className="refresh-warning" role="alert">{inviteError}</p>}
                <div className="page-heading-actions">
                  <button type="button" className="export-button" onClick={() => setShowInviteForm(false)} disabled={inviteSubmitting}>Batal</button>
                  <button type="submit" className="export-button" disabled={inviteSubmitting || !inviteForm.username}>
                    {inviteSubmitting ? "Mengundang…" : "Buat akun login"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Add Driver Form */}
          {showForm && (
            <section className="panel" aria-label="Tambah driver">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Tambah driver</h2></div>
                  <p>Isi data pengemudi baru.</p>
                </div>
                <button className="square-button" onClick={() => setShowForm(false)} aria-label="Tutup form"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit} className="trip-form">
                <div className="form-grid">
                  <label>
                    <span>Kode driver</span>
                    <input type="text" value={form.code} readOnly className="readonly-input" />
                  </label>
                  <label>
                    <span>Nama driver</span>
                    <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap pengemudi" required />
                  </label>
                  <label>
                    <span>Telepon</span>
                    <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                  </label>
                </div>
                {formError && <p className="refresh-warning" role="alert">{formError}</p>}
                <div className="page-heading-actions">
                  <button type="button" className="export-button" onClick={() => setShowForm(false)} disabled={submitting}>Batal</button>
                  <button type="submit" className="export-button" disabled={submitting || !form.code || !form.name}>
                    {submitting ? "Menyimpan…" : "Simpan driver"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Drivers Table */}
          <section className="panel" aria-label="Daftar driver">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Driver terdaftar</h2><span className="count-chip">{drivers.length}</span></div>
                <p>Pengemudi operasional tenant.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>KODE</th><th>NAMA</th><th>TELEPON</th><th>STATUS</th></tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id}>
                      <td>{d.code}</td>
                      <td>{d.name}</td>
                      <td>{d.phone ?? "—"}</td>
                      <td>{d.status}</td>
                    </tr>
                  ))}
                  {!drivers.length && <tr><td colSpan={4} className="table-empty">Belum ada driver.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> {drivers.length} driver</span>
          </footer>
        </main>
      </section>
    </div>
  );
}