"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Plus, RefreshCw, Trash2, UserRound, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, apiFetchUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type TenantUser = {
  id: string;
  username: string;
  displayName: string;
  status: string;
  role: string;
  driver?: { id: string; code: string; name: string } | null;
};

type UserDetail = TenantUser & { membershipId?: string; membershipStatus?: string };

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk mengelola pengguna.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "USER_NOT_FOUND":
      return "Pengguna tidak ditemukan.";
    default:
      return "Gagal. Periksa data lalu coba lagi.";
  }
}

export default function TenantUsersPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", displayName: "", password: "", role: "TENANT_DRIVER", driverId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<{ user: { username: string; displayName: string }; membership: { role: string; status: string } } | null>(null);

  // Detail/Edit/Delete state
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: "", role: "TENANT_DRIVER", status: "ACTIVE", password: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadUsers = async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat pengguna");
      const data = await res.json();
      const raw = Array.isArray(data) ? data : data.data ?? [];
      setUsers(raw.map((m: any) => ({
        id: m.user?.id ?? m.id,
        username: m.user?.username ?? m.username,
        displayName: m.user?.displayName ?? m.displayName,
        status: m.user?.status ?? m.status,
        role: m.role ?? "—",
        driver: m.user?.driver ?? null,
      })));
      setSessionState("ready");
      setRefreshError(null);
    } catch {
      if (silent) setRefreshError("Pembaruan gagal. Data terakhir tetap ditampilkan.");
      else setSessionState("data-error");
    }
  };

  const loadDrivers = async () => {
    try {
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/drivers`, { credentials: "include" });
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

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setCreateResult(null);
    try {
      const csrfRes = await apiFetchUrl(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          username: createForm.username.trim(),
          displayName: createForm.displayName.trim() || createForm.username.trim(),
          password: createForm.password,
          role: createForm.role,
          driverId: createForm.driverId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      const result = await res.json();
      setCreateResult(result);
      setShowCreateForm(false);
      setCreateForm({ username: "", displayName: "", password: "", role: "TENANT_DRIVER", driverId: "" });
      await loadUsers(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectUser = async (user: TenantUser) => {
    try {
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/users/${user.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser({ ...user, ...data, driver: data.driver ?? user.driver });
      } else {
        setSelectedUser(user);
      }
    } catch {
      setSelectedUser(user);
    }
  };

  const startEdit = (user: TenantUser) => {
    setSelectedUser(user);
    setEditForm({
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      password: "",
    });
    setShowEditForm(true);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const csrfRes = await apiFetchUrl(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const body: any = {};
      if (editForm.displayName.trim()) body.displayName = editForm.displayName.trim();
      if (editForm.role) body.role = editForm.role;
      if (editForm.status) body.status = editForm.status;
      if (editForm.password.trim()) body.password = editForm.password.trim();
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/users/${selectedUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setShowEditForm(false);
      setSelectedUser(null);
      await loadUsers(true);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const csrfRes = await apiFetchUrl(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setDeleteConfirm(null);
      setSelectedUser(null);
      await loadUsers(true);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menonaktifkan");
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat pengguna…</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canManageUsers = sessionUser?.tenantRole === "TENANT_ADMIN" || hasPermission(sessionUser, "admin:manage_users");

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Pengguna</strong></div>
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
              <h1>Pengguna Tenant</h1>
              <p>Kelola pengguna dan akun login untuk field app.</p>
            </div>
            <div className="page-heading-actions">
              {canManageUsers && (
                <button className="trip-create-trigger" onClick={() => setShowCreateForm(true)}>
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
          <section className="kpi-grid kpi-grid-4" aria-label="Ringkasan pengguna" style={{ marginBottom: "1rem" }}>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-blue"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Total</span></div>
              <p className="kpi-label">Total Pengguna</p>
              <div className="kpi-value">{users.length} <span>akun</span></div>
              <div className="kpi-foot">Semua role</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-green"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
              <p className="kpi-label">Pengguna Aktif</p>
              <div className="kpi-value">{users.filter((u) => u.status === "ACTIVE").length} <span>akun</span></div>
              <div className="kpi-foot">Bisa login</div>
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

          {/* Create Result */}
          {createResult && (
            <section className="panel" aria-label="Akun dibuat" style={{ marginBottom: "1rem", border: "2px solid #22c55e" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Akun Berhasil Dibuat</h2></div>
                </div>
                <button className="square-button" onClick={() => setCreateResult(null)} aria-label="Tutup"><X size={16} /></button>
              </div>
              <div style={{ padding: "1rem" }}>
                <p><strong>Username:</strong> {createResult.user.username}</p>
                <p><strong>Nama:</strong> {createResult.user.displayName}</p>
                <p><strong>Role:</strong> {createResult.membership.role}</p>
                <p><strong>Status:</strong> {createResult.membership.status}</p>
              </div>
            </section>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className="trip-modal-backdrop" onClick={() => !submitting && setShowCreateForm(false)}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-user-title">
                <button className="trip-modal-close" onClick={() => setShowCreateForm(false)} disabled={submitting} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <UserRound size={18} />
                  </div>
                  <div>
                    <h2 id="create-user-title">Buat akun pengguna</h2>
                    <p>Buat akun login untuk pengguna field app.</p>
                  </div>
                </div>
                <form onSubmit={handleCreateUser} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Username
                      </span>
                      <input type="text" value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} placeholder="username" required />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        Nama tampilan
                      </span>
                      <input type="text" value={createForm.displayName} onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Nama lengkap" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Password
                      </span>
                      <input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password (min 8 karakter)" required minLength={8} />
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
                      <select value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value, driverId: "" }))}>
                        <option value="TENANT_ADMIN">Tenant Admin</option>
                        <option value="TENANT_OPERATOR">Tenant Operator</option>
                        <option value="TENANT_DRIVER">Tenant Driver</option>
                        <option value="TENANT_VIEWER">Tenant Viewer</option>
                      </select>
                    </div>
                    {createForm.role === "TENANT_DRIVER" && (
                      <div className="trip-form-field">
                        <span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                          </svg>
                          Link ke Driver
                        </span>
                        <select value={createForm.driverId} onChange={(e) => setCreateForm((f) => ({ ...f, driverId: e.target.value }))}>
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
                    <button type="button" className="trip-action-button muted" onClick={() => setShowCreateForm(false)} disabled={submitting}>
                      Batal
                    </button>
                    <button type="submit" className="trip-action-button primary" disabled={submitting || !createForm.password}>
                      {submitting ? "Membuat..." : "Buat akun"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Form */}
          {showEditForm && selectedUser && (
            <div className="trip-modal-backdrop" onClick={() => { if (!editSubmitting) { setShowEditForm(false); setSelectedUser(null); } }}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
                <button className="trip-modal-close" onClick={() => { setShowEditForm(false); setSelectedUser(null); }} disabled={editSubmitting} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h2 id="edit-user-title">Edit pengguna</h2>
                    <p>Perbarui data {selectedUser.username}.</p>
                  </div>
                </div>
                <form onSubmit={handleUpdate} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Username
                      </span>
                      <input type="text" value={selectedUser.username} readOnly className="readonly-input" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        Nama tampilan
                      </span>
                      <input type="text" value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Nama lengkap" />
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
                      <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                        <option value="TENANT_ADMIN">Tenant Admin</option>
                        <option value="TENANT_OPERATOR">Tenant Operator</option>
                        <option value="TENANT_DRIVER">Tenant Driver</option>
                        <option value="TENANT_VIEWER">Tenant Viewer</option>
                      </select>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Status
                      </span>
                      <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                        <option value="ACTIVE">Aktif</option>
                        <option value="SUSPENDED">Suspend</option>
                        <option value="INACTIVE">Nonaktif</option>
                      </select>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Password baru (opsional)
                      </span>
                      <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} placeholder="Kosongkan jika tidak diubah" />
                    </div>
                  </div>
                  {editError && (
                    <div className="trip-modal-error" role="alert">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      <span>{editError}</span>
                    </div>
                  )}
                  <div className="trip-action-buttons">
                    <button type="button" className="trip-action-button muted" onClick={() => { setShowEditForm(false); setSelectedUser(null); }} disabled={editSubmitting}>
                      Batal
                    </button>
                    <button type="submit" className="trip-action-button primary" disabled={editSubmitting}>
                      {editSubmitting ? "Menyimpan..." : "Simpan perubahan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirm */}
          {deleteConfirm && (
            <div className="trip-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
              <div className="trip-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-user-title" style={{ width: "min(100%, 420px)" }}>
                <button className="trip-modal-close" onClick={() => setDeleteConfirm(null)} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon danger">
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <h2 id="delete-user-title">Konfirmasi Nonaktifkan</h2>
                    <p>Apakah Anda yakin ingin menonaktifkan pengguna ini? Tindakan ini dapat dibatalkan nanti.</p>
                  </div>
                </div>
                <div className="trip-action-buttons">
                  <button type="button" className="trip-action-button muted" onClick={() => setDeleteConfirm(null)}>
                    Batal
                  </button>
                  <button type="button" className="trip-action-button danger" onClick={() => handleDelete(deleteConfirm)}>
                    Nonaktifkan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detail Panel */}
          {selectedUser && !showEditForm && (
            <section className="panel" aria-label="Detail pengguna" style={{ marginBottom: "1rem" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Detail Pengguna</h2></div>
                </div>
                <button className="square-button" onClick={() => setSelectedUser(null)} aria-label="Tutup"><X size={16} /></button>
              </div>
              <div style={{ padding: "1rem" }}>
                <p><strong>Username:</strong> {selectedUser.username}</p>
                <p><strong>Nama:</strong> {selectedUser.displayName}</p>
                <p><strong>Role:</strong> {selectedUser.role}</p>
                <p><strong>Status:</strong> {selectedUser.status}</p>
                {selectedUser.driver && <p><strong>Driver:</strong> {selectedUser.driver.code} · {selectedUser.driver.name}</p>}
                <div className="page-heading-actions" style={{ marginTop: "0.5rem" }}>
                  <button className="export-button" onClick={() => startEdit(selectedUser)}>
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button className="export-button" style={{ background: "#ef4444", color: "#fff" }} onClick={() => setDeleteConfirm(selectedUser.id)}>
                    <Trash2 size={15} />
                    Nonaktifkan
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Users Table */}
          <section className="panel" aria-label="Daftar pengguna">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Pengguna terdaftar</h2><span className="count-chip">{users.length}</span></div>
                <p>Pengguna dan akun login tenant.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>USERNAME</th><th>NAMA</th><th>ROLE</th><th>STATUS</th><th>DRIVER</th><th><span className="sr-only">Aksi</span></th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => handleSelectUser(u)}>
                      <td>{u.username}</td>
                      <td>{u.displayName}</td>
                      <td>{u.role}</td>
                      <td>{u.status}</td>
                      <td>{u.driver ? `${u.driver.code} · ${u.driver.name}` : "—"}</td>
                      <td>
                        <button type="button" className="row-detail-link" onClick={(e) => { e.stopPropagation(); handleSelectUser(u); }}>Detail</button>
                      </td>
                    </tr>
                  ))}
                  {!users.length && <tr><td colSpan={6} className="table-empty">Belum ada pengguna.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> {users.length} pengguna</span>
          </footer>
        </main>
      </section>
    </div>
  );
}
