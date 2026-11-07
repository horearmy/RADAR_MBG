"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, RefreshCw } from "lucide-react";
import { apiBaseUrl, apiGet, getCurrentSession, isPlatformAdmin, type SessionUser } from "@/lib/api";

type PlatformTenant = {
  id: string;
  tenantCode: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function PlatformTenantsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await apiGet<PlatformTenant[]>("/platform/tenants");
      setTenants(rows);
    } catch {
      setError("Daftar tenant tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  const tenantAction = async (id: string, action: "suspend" | "archive" | "reactivate") => {
    setActionLoading(id);
    setError("");
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const csrf = await csrfRes.json().catch(() => null);
      if (!csrfRes.ok || !csrf?.csrfToken) throw new Error("Gagal memulai sesi keamanan.");
      const res = await fetch(`${apiBaseUrl}/platform/tenants/${id}/${action}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.csrfToken },
        body: JSON.stringify({ reason: "platform admin action" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Gagal (${res.status})`);
      }
      await loadTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses tenant.");
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    let active = true;
    void getCurrentSession().then((session) => {
      if (!active) return;
      setUser(session);
      if (!isPlatformAdmin(session)) {
        setError("Halaman ini hanya tersedia untuk administrator platform.");
        setLoading(false);
        return;
      }
      void loadTenants();
    }).catch(() => {
      if (active) {
        setError("Sesi tidak dapat diverifikasi.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [loadTenants]);

  const statusLabel = (status: string) => ({ ACTIVE: "Aktif", PENDING_ACTIVATION: "Menunggu aktivasi", SUSPENDED: "Ditangguhkan" } as Record<string, string>)[status] ?? status;

  return (
    <main className="platform-tenants-page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">PLATFORM / TENANT</p>
          <h1 className="page-title">Tenant terdaftar</h1>
          <p className="page-subtitle">Tampilan baca-saja untuk pemantauan tenant pada platform.</p>
        </div>
        <button className="btn" type="button" onClick={() => void loadTenants()} disabled={loading || !isPlatformAdmin(user)}><RefreshCw size={14} /> Muat ulang</button>
<Link className="btn btn-primary" href="/previews">Review Penerima</Link>
      </header>
      <section className="panel">
        <div className="panel-header"><div className="platform-tenant-heading"><Building2 size={17} /><strong>Daftar tenant</strong><span>{tenants.length}</span></div></div>
        {error ? <div className="table-state error" role="alert">{error}</div> : loading ? <div className="table-state">Memuat daftar tenant…</div> : tenants.length === 0 ? <div className="empty-state">Belum ada tenant terdaftar.</div> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>KODE</th><th>NAMA TENANT</th><th>STATUS</th><th>TERDAFTAR</th><th>AKSI</th></tr></thead>
              <tbody>{tenants.map((tenant) => (
  <tr key={tenant.id}>
    <td className="mono">{tenant.tenantCode}</td>
    <td>{tenant.name}</td>
    <td><span className={`pill ${tenant.status === "ACTIVE" ? "pill-active" : "pill-warning"}`}>{statusLabel(tenant.status)}</span></td>
    <td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(tenant.createdAt))}</td>
    <td>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tenant.status === "ACTIVE" && <button className="btn btn-ghost" disabled={actionLoading === tenant.id} onClick={() => void tenantAction(tenant.id, "suspend")}>Tangguhkan</button>}
        {tenant.status === "ACTIVE" && <button className="btn btn-danger" disabled={actionLoading === tenant.id} onClick={() => void tenantAction(tenant.id, "archive")}>Arsipkan</button>}
        {(tenant.status === "SUSPENDED" || tenant.status === "INACTIVE" || tenant.status === "ARCHIVED") && <button className="btn btn-success" disabled={actionLoading === tenant.id} onClick={() => void tenantAction(tenant.id, "reactivate")}>Aktifkan</button>}
        {tenant.status !== "ACTIVE" && tenant.status !== "ARCHIVED" && <button className="btn btn-danger" disabled={actionLoading === tenant.id} onClick={() => void tenantAction(tenant.id, "archive")}>Arsipkan</button>}
      </div>
    </td>
  </tr>
))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
