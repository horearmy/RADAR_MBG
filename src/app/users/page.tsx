"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, RefreshCw, Shield, UserRound, Users } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import {
  createAdminInvitation,
  createAdminPasswordReset,
  assignAdminUserRole,
  getAdminRoles,
  getAdminUsers,
  getCurrentSession,
  hasPermission,
  revokeAdminUserRole,
  revokeAdminUserSessions,
  resendAdminInvitation,
  resetAdminUserMfa,
  updateAdminUserStatus,
  type AdminRoleSummary,
  type AdminUserSummary,
  type IssuedAccountToken,
  type SessionUser,
} from "@/lib/api";

const PAGE_SIZE = 20;

function statusText(status: string) {
  return ({ ACTIVE: "Aktif", INVITED: "Diundang", SUSPENDED: "Ditangguhkan", INACTIVE: "Nonaktif" } as Record<string, string>)[status] ?? status;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "Belum pernah masuk";
}

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [roles, setRoles] = useState<AdminRoleSummary[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [statusValues, setStatusValues] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [roleCode, setRoleCode] = useState("");
  const [scopeType, setScopeType] = useState("sppg");
  const [scopeId, setScopeId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [inviteForm, setInviteForm] = useState({ username: "", email: "", displayName: "", reason: "" });
  const [issuedToken, setIssuedToken] = useState<(IssuedAccountToken & { purpose: "INVITATION" | "PASSWORD_RESET" | "MFA_RESET" }) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const current = await getCurrentSession();
      if (!hasPermission(current, "admin:manage_users")) {
        setUser(current);
        return;
      }
      setUser(current);
      const manageRoles = hasPermission(current, "admin:manage_roles");
      setCanManageRoles(manageRoles);
      const [result, roleList] = await Promise.all([
        getAdminUsers({ page, pageSize: PAGE_SIZE, ...(search ? { search } : {}), ...(statusFilter ? { status: statusFilter } : {}) }),
        manageRoles ? getAdminRoles() : Promise.resolve([]),
      ]);
      setUsers(result.data);
      setTotal(result.pagination.total);
      setRoles(roleList);
      setAssignUserId((currentId) => currentId || result.data[0]?.id || "");
    } catch (loadError: unknown) {
      if (loadError instanceof Error && loadError.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setError("Data akun gagal dimuat. Periksa koneksi atau izin akun, lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [page, router, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, reloadKey]);

  async function changeStatus(target: AdminUserSummary) {
    const status = statusValues[target.id] ?? target.status;
    const reason = reasons[`status:${target.id}`]?.trim() ?? "";
    if (status === target.status || reason.length < 3) return;
    setBusy(target.id);
    setError("");
    setNotice("");
    try {
      await updateAdminUserStatus(target.id, { status, reason });
      setNotice(`Status akun ${target.username} diperbarui; sesi aktif telah dicabut.`);
      setReloadKey((value) => value + 1);
    } catch {
      setError("Perubahan status ditolak. Periksa alasan, status akun, dan perlindungan administrator terakhir.");
    } finally {
      setBusy("");
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("invitation");
    setError("");
    setNotice("");
    try {
      const result = await createAdminInvitation({
        username: inviteForm.username.trim(),
        ...(inviteForm.email.trim() ? { email: inviteForm.email.trim() } : {}),
        displayName: inviteForm.displayName.trim(),
        reason: inviteForm.reason.trim(),
      });
      setIssuedToken({ ...result, purpose: "INVITATION" });
      setInviteForm({ username: "", email: "", displayName: "", reason: "" });
      setNotice(`Undangan ${result.user.username} siap. Token hanya ditampilkan sekali; kirim melalui kanal aman.`);
      setReloadKey((value) => value + 1);
    } catch {
      setError("Undangan gagal dibuat. Username/email mungkin sudah digunakan, atau alasan tidak valid.");
    } finally {
      setBusy("");
    }
  }

  async function createPasswordResetFor(target: AdminUserSummary) {
    const reason = reasons[`password-reset:${target.id}`]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(target.id);
    setError("");
    setNotice("");
    try {
      const result = await createAdminPasswordReset(target.id, { reason });
      setIssuedToken({ ...result, purpose: "PASSWORD_RESET" });
      setNotice(`Token reset untuk ${target.username} hanya ditampilkan sekali; kirim lewat kanal aman.`);
      setReasons((values) => ({ ...values, [`password-reset:${target.id}`]: "" }));
    } catch {
      setError("Token reset gagal dibuat. Hanya akun aktif yang dapat menerima reset password.");
    } finally {
      setBusy("");
    }
  }

  async function createMfaResetFor(target: AdminUserSummary) {
    const reason = reasons[`mfa-reset:${target.id}`]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(target.id);
    setError("");
    setNotice("");
    try {
      const result = await resetAdminUserMfa(target.id, { reason });
      setIssuedToken({ ...result, purpose: "MFA_RESET" });
      setNotice(`MFA ${target.username} direset; token pemulihan hanya ditampilkan sekali. Kirim melalui kanal aman.`);
      setReasons((values) => ({ ...values, [`mfa-reset:${target.id}`]: "" }));
      setReloadKey((value) => value + 1);
    } catch {
      setError("Reset MFA ditolak. Pastikan akun MFA aktif, alasan diisi, dan reset dilakukan admin lain dengan MFA aktif.");
    } finally {
      setBusy("");
    }
  }

  async function resendInvitationFor(target: AdminUserSummary) {
    const reason = reasons[`invitation-resend:${target.id}`]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(target.id);
    setError("");
    setNotice("");
    try {
      const result = await resendAdminInvitation(target.id, { reason });
      setIssuedToken({ ...result, purpose: "INVITATION" });
      setNotice(`Token undangan baru untuk ${target.username} menggantikan token sebelumnya.`);
      setReasons((values) => ({ ...values, [`invitation-resend:${target.id}`]: "" }));
    } catch {
      setError("Undangan ulang hanya dapat dibuat untuk akun berstatus Diundang.");
    } finally {
      setBusy("");
    }
  }

  async function revokeSessions(target: AdminUserSummary) {
    const reason = reasons[`sessions:${target.id}`]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(target.id);
    setError("");
    setNotice("");
    try {
      const result = await revokeAdminUserSessions(target.id, { reason }) as { revokedSessionCount?: number };
      setNotice(`${result.revokedSessionCount ?? "Semua"} sesi aktif ${target.username} dicabut.`);
      setReasons((values) => ({ ...values, [`sessions:${target.id}`]: "" }));
    } catch {
      setError("Sesi akun gagal dicabut. Coba lagi.");
    } finally {
      setBusy("");
    }
  }

  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = reasons[`role:${assignUserId}`]?.trim() ?? "";
    const selected = roles.find((role) => role.code === roleCode);
    if (!assignUserId || !selected || reason.length < 3 || (!selected.isGlobal && !scopeId.trim())) return;
    setBusy(assignUserId);
    setError("");
    setNotice("");
    try {
      await assignAdminUserRole(assignUserId, {
        roleCode,
        ...(selected.isGlobal ? {} : { [`${scopeType}Id`]: scopeId.trim() }),
        reason,
      });
      setNotice(`Role ${roleCode} ditetapkan dan sesi akun dicabut agar permission diperbarui.`);
      setScopeId("");
      setReasons((values) => ({ ...values, [`role:${assignUserId}`]: "" }));
      setReloadKey((value) => value + 1);
    } catch {
      setError("Role tidak dapat ditetapkan. Periksa scope, duplikasi, dan prasyarat MFA untuk role administratif.");
    } finally {
      setBusy("");
    }
  }

  async function removeRole(target: AdminUserSummary, assignmentId: string) {
    const reason = reasons[`role-revoke:${assignmentId}`]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(target.id);
    setError("");
    try {
      await revokeAdminUserRole(target.id, { userRoleId: assignmentId, reason });
      setNotice(`Role dicabut dari ${target.username}; sesi aktif juga dicabut.`);
      setReloadKey((value) => value + 1);
    } catch {
      setError("Role tidak dapat dicabut. Pastikan tidak sedang menghapus administrator global terakhir.");
    } finally {
      setBusy("");
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  if (loading && !user) return <main className="session-state"><span className="session-spinner" /><p>Memuat administrasi akun…</p></main>;
  if (!user) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>{error || "Sesi tidak dapat diverifikasi."}</p><Link className="session-retry" href="/login">Masuk</Link></main>;
  if (!hasPermission(user, "admin:manage_users")) return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>Peran Anda tidak memiliki izin administrasi akun.</p><Link className="session-retry" href="/">Kembali ke dashboard</Link></main>;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedRole = roles.find((role) => role.code === roleCode);
  return (
    <main className="approval-page">
      <header className="approval-topbar"><Link href="/" className="approval-back"><ArrowLeft size={15} /> Dashboard</Link><div className="approval-brand"><span className="brand-mark"><span /><span /><span /></span><strong>RADAR<span>MBG</span></strong></div><HeaderAccount user={user} /></header>
      <div className="users-content">
        <div className="approval-heading"><div className="approval-heading-icon"><Users size={19} /></div><div><div className="eyebrow"><span className="eyebrow-line" />IDENTITY · RBAC</div><h1>Administrasi akun</h1><p>Kelola status, assignment role/scope, dan pencabutan sesi dengan audit.</p></div><button className="approval-refresh" onClick={() => setReloadKey((value) => value + 1)} type="button"><RefreshCw size={14} /> Muat ulang</button></div>
        {notice && <div className="approval-notice" role="status">{notice}</div>}
        {error && <div className="approval-error" role="alert">{error}</div>}

        {issuedToken && <section className="panel issued-token-panel"><div><h2>{issuedToken.purpose === "INVITATION" ? "Token undangan" : issuedToken.purpose === "MFA_RESET" ? "Token pemulihan MFA" : "Token reset password"}</h2><p>Berlaku sampai {formatDate(issuedToken.expiresAt)}. RADAR tidak menyimpan token mentah; salin dan kirim sekarang melalui kanal aman.</p></div><code>{issuedToken.token}</code><div><Link href={issuedToken.purpose === "MFA_RESET" ? "/security/mfa/recovery" : "/account-access"}>{issuedToken.purpose === "MFA_RESET" ? "Halaman pemulihan MFA" : "Halaman penerimaan akun"}</Link><button className="approval-button approve" onClick={() => void navigator.clipboard.writeText(issuedToken.token)} type="button">Salin token</button><button className="approval-button reject" onClick={() => setIssuedToken(null)} type="button">Tutup</button></div></section>}

        <section className="panel user-invitation-panel"><div className="panel-heading"><div><h2>Undang pengguna</h2><p>Buat akun INVITED dan token sekali pakai 48 jam untuk menetapkan password.</p></div><Users size={16} /></div><form className="user-invitation-form" onSubmit={submitInvitation}><label><span>Username</span><input autoComplete="off" maxLength={80} minLength={3} onChange={(event) => setInviteForm((values) => ({ ...values, username: event.target.value }))} pattern="[A-Za-z0-9._-]+" required value={inviteForm.username} /></label><label><span>Nama tampilan</span><input maxLength={160} minLength={2} onChange={(event) => setInviteForm((values) => ({ ...values, displayName: event.target.value }))} required value={inviteForm.displayName} /></label><label><span>Email (opsional)</span><input autoComplete="email" maxLength={254} onChange={(event) => setInviteForm((values) => ({ ...values, email: event.target.value }))} type="email" value={inviteForm.email} /></label><label className="user-invitation-reason"><span>Alasan</span><textarea maxLength={2000} minLength={3} onChange={(event) => setInviteForm((values) => ({ ...values, reason: event.target.value }))} required value={inviteForm.reason} /></label><button className="approval-button approve" disabled={busy === "invitation"} type="submit">{busy === "invitation" ? "Membuat…" : "Buat undangan"}</button></form></section>

        {canManageRoles && <section className="panel user-role-panel"><div className="panel-heading"><div><h2>Assignment role</h2><p>Role global tidak memiliki scope; role lain wajib memiliki tepat satu scope.</p></div><Shield size={16} /></div><form className="user-role-form" onSubmit={submitRole}>
          <label><span>Akun</span><select onChange={(event) => setAssignUserId(event.target.value)} value={assignUserId}>{users.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.username}</option>)}</select></label>
          <label><span>Role</span><select onChange={(event) => { setRoleCode(event.target.value); setScopeId(""); }} required value={roleCode}><option value="">Pilih role</option>{roles.map((role) => <option key={role.id} value={role.code}>{role.name}{role.requiresMfa ? " · MFA wajib" : ""}</option>)}</select></label>
          {selectedRole && !selectedRole.isGlobal && <><label><span>Tipe scope</span><select onChange={(event) => setScopeType(event.target.value)} value={scopeType}><option value="sppg">SPPG</option><option value="region">Wilayah</option><option value="organization">Organisasi</option></select></label><label><span>ID scope</span><input onChange={(event) => setScopeId(event.target.value)} placeholder={`UUID ${scopeType}`} required value={scopeId} /></label></>}
          <label className="user-reason"><span>Alasan</span><textarea maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`role:${assignUserId}`]: event.target.value }))} required value={reasons[`role:${assignUserId}`] ?? ""} /></label>
          <button className="approval-button approve" disabled={busy === assignUserId || !users.length || (selectedRole?.requiresMfa === true && !users.find((item) => item.id === assignUserId)?.mfaEnabled)} type="submit">Tetapkan role</button>
          {selectedRole?.requiresMfa && !users.find((item) => item.id === assignUserId)?.mfaEnabled && <span className="user-mfa-warning">Akun harus mengaktifkan MFA dari sesi miliknya sebelum menerima role ini.</span>}
        </form></section>}

        <form className="user-filters panel" onSubmit={submitSearch}><label><span>Cari akun</span><input maxLength={120} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nama, username, atau email" value={searchInput} /></label><label><span>Status</span><select onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} value={statusFilter}><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="INVITED">Diundang</option><option value="SUSPENDED">Ditangguhkan</option><option value="INACTIVE">Nonaktif</option></select></label><button className="approval-button approve" type="submit">Cari</button></form>

        <div className="user-list-heading"><div><h2>Pengguna</h2><p>{total.toLocaleString("id-ID")} akun</p></div><span>Halaman {page}{totalPages ? ` dari ${totalPages}` : ""}</span></div>
        {loading ? <div className="approval-empty"><span className="session-spinner" /><span>Memuat akun…</span></div> : users.length ? <div className="user-list">{users.map((target) => <article className="user-card" key={target.id}>
          <div className="user-card-heading"><div className="user-avatar"><UserRound size={17} /></div><div className="user-card-name"><strong>{target.displayName}</strong><span>{target.username}{target.email ? ` · ${target.email}` : ""}</span></div><span className={`approval-status ${target.status === "ACTIVE" ? "complete" : "pending"}`}><span />{statusText(target.status)}</span></div>
          <div className="user-meta"><span><small>MFA</small><strong>{target.mfaEnabled ? "Aktif" : "Belum aktif"}</strong></span><span><small>Login terakhir</small><strong>{formatDate(target.lastLoginAt)}</strong></span><span><small>Dibuat</small><strong>{formatDate(target.createdAt)}</strong></span></div>
          <div className="user-roles"><small>Role aktif</small>{target.roles.length ? target.roles.map((assignment) => <div className="user-role-row" key={assignment.id}><span><strong>{assignment.role.name}</strong><small>{assignment.role.isGlobal ? "Global" : assignment.sppgId ? `SPPG ${assignment.sppgId}` : assignment.regionId ? `Wilayah ${assignment.regionId}` : `Organisasi ${assignment.organizationId}`}</small></span>{canManageRoles && <div className="user-role-revoke"><input aria-label={`Alasan pencabutan ${assignment.role.name}`} maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`role-revoke:${assignment.id}`]: event.target.value }))} placeholder="Alasan pencabutan" value={reasons[`role-revoke:${assignment.id}`] ?? ""} /><button className="approval-button reject" disabled={busy === target.id || (reasons[`role-revoke:${assignment.id}`]?.trim().length ?? 0) < 3} onClick={() => void removeRole(target, assignment.id)} type="button">Cabut</button></div>}</div>) : <span className="user-no-role">Belum ada role aktif</span>}</div>
          <div className="user-actions">
            <div><label htmlFor={`status-${target.id}`}>Status akun</label><select id={`status-${target.id}`} onChange={(event) => setStatusValues((values) => ({ ...values, [target.id]: event.target.value }))} value={statusValues[target.id] ?? target.status}><option disabled value="INVITED">Diundang</option><option value="ACTIVE">Aktif</option><option value="SUSPENDED">Ditangguhkan</option><option value="INACTIVE">Nonaktif</option></select><input aria-label="Alasan perubahan status" maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`status:${target.id}`]: event.target.value }))} placeholder="Alasan perubahan status" value={reasons[`status:${target.id}`] ?? ""} /><button className="approval-button approve" disabled={busy === target.id || (statusValues[target.id] ?? target.status) === target.status || (reasons[`status:${target.id}`]?.trim().length ?? 0) < 3} onClick={() => void changeStatus(target)} type="button">Simpan</button></div>
            <div><label htmlFor={`revoke-${target.id}`}>Cabut seluruh sesi</label><input id={`revoke-${target.id}`} maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`sessions:${target.id}`]: event.target.value }))} placeholder="Alasan pencabutan sesi" value={reasons[`sessions:${target.id}`] ?? ""} /><button className="approval-button reject" disabled={busy === target.id || (reasons[`sessions:${target.id}`]?.trim().length ?? 0) < 3} onClick={() => void revokeSessions(target)} type="button"><KeyRound size={13} /> Cabut sesi</button></div>
            <div><label htmlFor={`reset-${target.id}`}>Reset password</label><input id={`reset-${target.id}`} maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`password-reset:${target.id}`]: event.target.value }))} placeholder="Alasan reset password" value={reasons[`password-reset:${target.id}`] ?? ""} /><button className="approval-button reject" disabled={busy === target.id || target.status !== "ACTIVE" || (reasons[`password-reset:${target.id}`]?.trim().length ?? 0) < 3} onClick={() => void createPasswordResetFor(target)} type="button"><KeyRound size={13} /> Buat token reset</button></div>
            {target.status === "ACTIVE" && target.mfaEnabled && target.id !== user.id && <div><label htmlFor={`mfa-reset-${target.id}`}>Reset MFA (admin lain)</label><input id={`mfa-reset-${target.id}`} maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`mfa-reset:${target.id}`]: event.target.value }))} placeholder="Alasan reset MFA" value={reasons[`mfa-reset:${target.id}`] ?? ""} /><button className="approval-button reject" disabled={busy === target.id || !user.mfaEnabled || (reasons[`mfa-reset:${target.id}`]?.trim().length ?? 0) < 3} onClick={() => void createMfaResetFor(target)} type="button"><Shield size={13} /> Terbitkan token</button></div>}
            {target.status === "INVITED" && <div><label htmlFor={`invitation-resend-${target.id}`}>Kirim ulang undangan</label><input id={`invitation-resend-${target.id}`} maxLength={2000} minLength={3} onChange={(event) => setReasons((values) => ({ ...values, [`invitation-resend:${target.id}`]: event.target.value }))} placeholder="Alasan undangan ulang" value={reasons[`invitation-resend:${target.id}`] ?? ""} /><button className="approval-button approve" disabled={busy === target.id || (reasons[`invitation-resend:${target.id}`]?.trim().length ?? 0) < 3} onClick={() => void resendInvitationFor(target)} type="button">Buat token baru</button></div>}
          </div>
        </article>)}</div> : <div className="approval-empty"><Users size={20} /><strong>Tidak ada akun</strong><span>Belum ada akun yang cocok dengan filter.</span></div>}
        <div className="audit-pagination"><span>Menampilkan {total ? ((page - 1) * PAGE_SIZE + 1).toLocaleString("id-ID") : 0}–{Math.min(page * PAGE_SIZE, total).toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")}</span><div><button aria-label="Halaman sebelumnya" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">‹</button><button aria-label="Halaman selanjutnya" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">›</button></div></div>
      </div>
    </main>
  );
}
