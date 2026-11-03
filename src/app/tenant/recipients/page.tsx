"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Plus, RefreshCw, UserRound, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type FieldUser = {
  id: string;
  username: string;
  displayName: string;
  status: string;
  role: string;
};

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk mengelola pengguna.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    default:
      return "Gagal. Periksa data lalu coba lagi.";
  }
}

export default function TenantRecipientsPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [users, setUsers] = useState<FieldUser[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "TENANT_DRIVER", driverId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ user: { username: string; displayName: string }; membership: { role: string; status: string } } | null>(null);

  const loadUsers = async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat pengguna");
      const data = await res.json();
      const raw = Array.isArray(data) ? data : data.data ?? [];
      // Filter only field app users (driver, operator)
      setUsers(raw
        .map((m: any) => ({
          id: m.user?.id ?? m.id,
          username: m.user?.username ?? m.username,
          displayName: m.user?.displayName ?? m.displayName,
          status: m.user?.status ?? m.status,
          role: m.role ?? "—",
        }))
        .filter((u: FieldUser) => u.role === "TENANT_DRIVER" || u.role === "TENANT_OPERATOR")
      );
      setSessionState("ready");
      setRefreshError(null);
    } catch {
      if (silent) setRefreshError("Pembaruan gagal. Data terakhir tetap ditampilkan.");
      else setSessionState("data-error");
    }
  };

  const loadDrivers = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/drivers`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDrivers(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await getCurrentSession();
        if (!active) return;
        setSessionUser(user);
        await loadUsers(false);
        await loadDrivers();
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
    try { await loadUsers(silent); } finally { setRefreshing(false); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setResult(null);
    try {
      const code = `USR-${Date.now().toString(36).toUpperCase()}`;
      const username = form.username.trim() || code.toLowerCase();
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          username,
          displayName: form.displayName.trim() || username,
          password: form.password,
          role: form.role,
          driverId: form.driverId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      const r = await res.json();
      setResult(r);
      setShowForm(false);
      setForm({ username: "", displayName: "", password: "", role: "TENANT_DRIVER", driverId: "" });
      await loadUsers(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat akun");
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat penerima…</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canManage = sessionUser?.tenantRole === "TENANT_ADMIN" || hasPermission(sessionUser, "admin:manage_users");

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Penerima</strong></div>
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
              <h1>Penerima (Field App Users)</h1>
              <p>Kelola akun login untuk personal yang menggunakan field app.</p>
            </div>
            <div className="page-heading-actions">
              {canManage && (
                <button className="trip-create-trigger" onClick={() => setShowForm(true)}>
                  <Plus size={14} />
                  Buat akun
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
          <section className="kpi-grid kpi-grid-4" aria-label="Ringkasan penerima" style={{ marginBottom: "1rem" }}>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-blue"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Total</span></div>
              <p className="kpi-label">Total Penerima</p>
              <div className="kpi-value">{users.length} <span>akun</span></div>
              <div className="kpi-foot">Field app users</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-green"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
              <p className="kpi-label">Penerima Aktif</p>
              <div className="kpi-value">{users.filter((u) => u.status === "ACTIVE").length} <span>akun</span></div>
              <div className="kpi-foot">Bisa login ke field app</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-navy"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Driver</span></div>
              <p className="kpi-label">Driver</p>
              <div className="kpi-value">{users.filter((u) => u.role === "TENANT_DRIVER").length} <span>akun</span></div>
              <div className="kpi-foot">Akun driver field app</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-amber"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Nonaktif</span></div>
              <p className="kpi-label">Nonaktif / Suspend</p>
              <div className="kpi-value">{users.filter((u) => u.status !== "ACTIVE").length} <span>akun</span></div>
              <div className="kpi-foot">Tidak bisa login</div>
            </article>
          </section>

          {result && (
            <section className="panel" aria-label="Akun dibuat" style={{ marginBottom: "1rem", border: "2px solid #22c55e" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Akun Berhasil Dibuat</h2></div>
                  <p>Pengguna bisa langsung login ke field app dengan username + password.</p>
                </div>
                <button className="square-button" onClick={() => setResult(null)} aria-label="Tutup"><X size={16} /></button>
              </div>
              <div style={{ padding: "1rem" }}>
                <p><strong>Username:</strong> {result.user.username}</p>
                <p><strong>Nama:</strong> {result.user.displayName}</p>
                <p><strong>Role:</strong> {result.membership.role}</p>
                <p><strong>Status:</strong> {result.membership.status}</p>
              </div>
            </section>
          )}

          {showForm && (
            <div className="trip-modal-backdrop" onClick={() => !submitting && setShowForm(false)}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-recipient-title">
                <button className="trip-modal-close" onClick={() => setShowForm(false)} disabled={submitting} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <UserRound size={18} />
                  </div>
                  <div>
                    <h2 id="create-recipient-title">Buat akun penerima</h2>
                    <p>Buat akun login untuk personal field app.</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Username
                      </span>
                      <input type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="username" />
                      <small>Kosongkan untuk auto-generate</small>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        Nama tampilan
                      </span>
                      <input type="text" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Nama lengkap" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Password
                      </span>
                      <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password (min 8 karakter)" required minLength={8} />
                      <small>Minimal 8 karakter</small>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        Role
                      </span>
                      <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, driverId: "" }))}>
                        <option value="TENANT_DRIVER">Driver (Field App)</option>
                        <option value="TENANT_OPERATOR">Operator</option>
                      </select>
                    </div>
                    {form.role === "TENANT_DRIVER" && (
                      <div className="trip-form-field">
                        <span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                          </svg>
                          Link ke Driver
                        </span>
                        <select value={form.driverId} onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}>
                          <option value="">Tidak link ke driver</option>
                          {drivers.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                        </select>
                      </div>
                    )}
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
                    <button type="submit" className="trip-action-button primary" disabled={submitting || !form.password}>
                      {submitting ? "Membuat..." : "Buat akun"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section className="panel" aria-label="Daftar penerima">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Penerima (Field App Users)</h2><span className="count-chip">{users.length}</span></div>
                <p>Personal yang menggunakan field app.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>USERNAME</th><th>NAMA</th><th>ROLE</th><th>STATUS</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.displayName}</td>
                      <td>{u.role}</td>
                      <td>{u.status}</td>
                    </tr>
                  ))}
                  {!users.length && <tr><td colSpan={4} className="table-empty">Belum ada penerima.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> {users.length} penerima</span>
          </footer>
        </main>
      </section>
    </div>
  );
}