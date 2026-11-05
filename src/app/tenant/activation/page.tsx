"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, RefreshCw } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, apiFetchUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type TenantUser = { id: string; username: string; displayName: string; status: string; role: string };

export default function TenantActivationPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [selected, setSelected] = useState<TenantUser | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
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
      })));
      setSessionState("ready");
    } catch {
      setSessionState("data-error");
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await getCurrentSession();
        if (!active) return;
        setSessionUser(user);
        await load();
      } catch {
        if (active) setSessionState("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  const invited = users.filter((u) => u.status === "INVITED");

  const handleActivate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    if (password.length < 14) { setError("Password minimal 14 karakter."); return; }
    if (password !== confirm) { setError("Konfirmasi password tidak cocok."); return; }
    setSubmitting(true);
    try {
      const csrfRes = await apiFetchUrl(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await apiFetchUrl(`${apiBaseUrl}/tenant/users/${selected.id}/activate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setSuccess(`Akun ${selected.username} berhasil diaktifkan.`);
      setSelected(null);
      setPassword("");
      setConfirm("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengaktifkan");
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat...</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canManage = hasPermission(sessionUser, "tenant:manage");

  return (
    <main className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Aktivasi Akun</strong></div>
          <div className="topbar-actions"><HeaderAccount user={sessionUser} /></div>
        </header>
        <div className="content-area">
          <div className="page">
            <header className="page-hero">
              <div>
                <p className="page-breadcrumb">Tenant &gt; Pengguna &gt; Aktivasi Akun</p>
                <h1 className="page-title">Aktivasi Akun Undangan</h1>
                <p className="page-subtitle">Aktifkan akun pengguna yang masih berstatus INVITED.</p>
              </div>
              <div className="page-actions">
                <button className="btn btn-ghost" onClick={() => void load()}><RefreshCw size={16} /> Muat ulang</button>
              </div>
            </header>

            {!canManage && <div className="panel"><p className="text-secondary">Anda tidak memiliki izin.</p></div>}

            {canManage && (
              <>
                {error && <div className="panel"><p className="text-secondary" style={{ color: "#DC2626" }}>{error}</p></div>}
                {success && <div className="panel"><p className="text-secondary" style={{ color: "#16A34A" }}>{success}</p></div>}

                <section className="panel" style={{ marginBottom: 16 }}>
                  <div className="panel-header">
                    <div>
                      <h2>Pengguna Undangan</h2>
                      <p>{invited.length} akun menunggu aktivasi</p>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Aksi</th></tr></thead>
                      <tbody>
                        {invited.length === 0 && <tr><td colSpan={4} className="empty-row">Tidak ada akun undangan</td></tr>}
                        {invited.map((u) => (
                          <tr key={u.id}>
                            <td>{u.username}</td>
                            <td>{u.displayName}</td>
                            <td>{u.role}</td>
                            <td>
                              <button className="btn btn-primary" onClick={() => setSelected(u)}>Aktifkan</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {selected && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>Aktifkan {selected.username}</h2>
                        <p>Buat password baru untuk akun ini.</p>
                      </div>
                    </div>
                    <form onSubmit={handleActivate} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
                      <input type="password" placeholder="Password baru (min. 14 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      <input type="password" placeholder="Konfirmasi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? "Memproses..." : "Aktifkan"}</button>
                        <button className="btn btn-ghost" type="button" onClick={() => { setSelected(null); setPassword(""); setConfirm(""); }}>Batal</button>
                      </div>
                    </form>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}