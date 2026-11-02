"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, Pencil, Plus, RefreshCw, Trash2, UserRound, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

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
      const res = await fetch(`${apiBaseUrl}/tenant/users`, { credentials: "include" });
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
      } catch {
        if (!active) return;
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
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/users`, {
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
      const res = await fetch(`${apiBaseUrl}/tenant/users/${user.id}`, { credentials: "include" });
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
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const body: any = {};
      if (editForm.displayName.trim()) body.displayName = editForm.displayName.trim();
      if (editForm.role) body.role = editForm.role;
      if (editForm.status) body.status = editForm.status;
      if (editForm.password.trim()) body.password = editForm.password.trim();
      const res = await fetch(`${apiBaseUrl}/tenant/users/${selectedUser.id}`, {
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
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/users/${userId}`, {
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
                <button className="export-button" onClick={() => setShowCreateForm(true)}>
                  <Plus size={15} />
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
            <section className="panel" aria-label="Buat akun" style={{ marginBottom: "1rem" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Buat akun pengguna</h2></div>
                  <p>Buat akun login untuk pengguna field app.</p>
                </div>
                <button className="square-button" onClick={() => setShowCreateForm(false)} aria-label="Tutup form"><X size={16} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="trip-form">
                <div className="form-grid">
                  <label>
                    <span>Username</span>
                    <input type="text" value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} placeholder="username" />
                  </label>
                  <label>
                    <span>Nama tampilan</span>
                    <input type="text" value={createForm.displayName} onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Nama lengkap" />
                  </label>
                  <label>
                    <span>Password</span>
                    <input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password (min 8 karakter)" required minLength={8} />
                  </label>
                  <label>
                    <span>Role</span>
                    <select value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value, driverId: "" }))}>
                      <option value="TENANT_ADMIN">Tenant Admin</option>
                      <option value="TENANT_OPERATOR">Tenant Operator</option>
                      <option value="TENANT_DRIVER">Tenant Driver</option>
                      <option value="TENANT_VIEWER">Tenant Viewer</option>
                    </select>
                  </label>
                  {createForm.role === "TENANT_DRIVER" && (
                    <label>
                      <span>Link ke Driver</span>
                      <select value={createForm.driverId} onChange={(e) => setCreateForm((f) => ({ ...f, driverId: e.target.value }))}>
                        <option value="">Tidak link ke driver</option>
                        {drivers.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {formError && <p className="refresh-warning" role="alert">{formError}</p>}
                <div className="page-heading-actions">
                  <button type="button" className="export-button" onClick={() => setShowCreateForm(false)} disabled={submitting}>Batal</button>
                  <button type="submit" className="export-button" disabled={submitting || !createForm.password}>
                    {submitting ? "Membuat…" : "Buat akun"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Edit Form */}
          {showEditForm && selectedUser && (
            <section className="panel" aria-label="Edit pengguna" style={{ marginBottom: "1rem" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Edit pengguna</h2></div>
                  <p>Perbarui data {selectedUser.username}.</p>
                </div>
                <button className="square-button" onClick={() => { setShowEditForm(false); setSelectedUser(null); }} aria-label="Tutup form"><X size={16} /></button>
              </div>
              <form onSubmit={handleUpdate} className="trip-form">
                <div className="form-grid">
                  <label>
                    <span>Username</span>
                    <input type="text" value={selectedUser.username} readOnly className="readonly-input" />
                  </label>
                  <label>
                    <span>Nama tampilan</span>
                    <input type="text" value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Nama lengkap" />
                  </label>
                  <label>
                    <span>Role</span>
                    <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                      <option value="TENANT_ADMIN">Tenant Admin</option>
                      <option value="TENANT_OPERATOR">Tenant Operator</option>
                      <option value="TENANT_DRIVER">Tenant Driver</option>
                      <option value="TENANT_VIEWER">Tenant Viewer</option>
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="ACTIVE">Aktif</option>
                      <option value="SUSPENDED">Suspend</option>
                      <option value="INACTIVE">Nonaktif</option>
                    </select>
                  </label>
                  <label>
                    <span>Password baru (opsional)</span>
                    <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} placeholder="Kosongkan jika tidak diubah" />
                  </label>
                </div>
                {editError && <p className="refresh-warning" role="alert">{editError}</p>}
                <div className="page-heading-actions">
                  <button type="button" className="export-button" onClick={() => { setShowEditForm(false); setSelectedUser(null); }} disabled={editSubmitting}>Batal</button>
                  <button type="submit" className="export-button" disabled={editSubmitting}>
                    {editSubmitting ? "Menyimpan…" : "Simpan perubahan"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Delete Confirm */}
          {deleteConfirm && (
            <section className="panel" aria-label="Konfirmasi hapus" style={{ marginBottom: "1rem", border: "2px solid #ef4444" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Konfirmasi Nonaktifkan</h2></div>
                  <p>Apakah Anda yakin ingin menonaktifkan pengguna ini?</p>
                </div>
              </div>
              <div className="page-heading-actions">
                <button className="export-button" onClick={() => setDeleteConfirm(null)}>Batal</button>
                <button className="export-button" style={{ background: "#ef4444", color: "#fff" }} onClick={() => handleDelete(deleteConfirm)}>Nonaktifkan</button>
              </div>
            </section>
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