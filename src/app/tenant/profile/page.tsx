"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Pencil, RefreshCw, Save, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type TenantProfile = {
  id: string;
  tenantCode: string;
  name: string;
  status: string;
  profile?: {
    sppgName: string;
    fullAddress: string;
    contactPhone: string;
    provinceCode: string;
    regencyCode: string;
    districtCode: string;
    villageCode: string;
    personInCharge: string;
    operationalHours: string;
    capacity: number | null;
    notes: string;
  } | null;
};

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "REQUEST_FAILED_403" || code === "FORBIDDEN") return "Peran Anda tidak memiliki izin.";
  if (code === "CSRF_INVALID" || code === "CSRF_UNAVAILABLE") return "Sesi keamanan kedaluwarsa. Muat ulang halaman.";
  return "Gagal. Periksa data lalu coba lagi.";
}

export default function TenantProfilePage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [me, setMe] = useState<TenantProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    sppgName: "", fullAddress: "", contactPhone: "", personInCharge: "",
    operationalHours: "", capacity: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadProfile = async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/me`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat profil");
      const data = await res.json();
      setMe(data);
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
        await loadProfile(false);
      } catch {
        if (!active) return;
        setSessionState("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  const handleRefresh = async (silent = true) => {
    setRefreshing(true);
    try { await loadProfile(silent); } finally { setRefreshing(false); }
  };

  const startEdit = () => {
    if (!me?.profile) return;
    setEditForm({
      sppgName: me.profile.sppgName ?? "",
      fullAddress: me.profile.fullAddress ?? "",
      contactPhone: me.profile.contactPhone ?? "",
      personInCharge: me.profile.personInCharge ?? "",
      operationalHours: me.profile.operationalHours ?? "",
      capacity: me.profile.capacity ? String(me.profile.capacity) : "",
      notes: me.profile.notes ?? "",
    });
    setShowEdit(true);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          sppgName: editForm.sppgName.trim() || undefined,
          fullAddress: editForm.fullAddress.trim() || undefined,
          contactPhone: editForm.contactPhone.trim() || undefined,
          personInCharge: editForm.personInCharge.trim() || undefined,
          operationalHours: editForm.operationalHours.trim() || undefined,
          capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
          notes: editForm.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setShowEdit(false);
      await loadProfile(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat profil…</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canEdit = hasPermission(sessionUser, "sppg:manage") || sessionUser?.tenantRole === "TENANT_ADMIN";

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Profil SPPG</strong></div>
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
              <h1>Profil SPPG</h1>
              <p>Informasi dan konfigurasi SPPG tenant.</p>
            </div>
            <div className="page-heading-actions">
              {canEdit && me?.profile && (
                <button className="export-button" onClick={startEdit}>
                  <Pencil size={15} />
                  Edit profil
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
          {me?.profile && (
            <section className="kpi-grid kpi-grid-4" aria-label="Ringkasan profil" style={{ marginBottom: "1rem" }}>
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-blue"><Building2 size={17} /></span><span className="kpi-trend trend-neutral">Tenant</span></div>
                <p className="kpi-label">Kode Tenant</p>
                <div className="kpi-value" style={{ fontSize: "1.1rem" }}>{me.tenantCode}</div>
                <div className="kpi-foot">{me.status}</div>
              </article>
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-green"><Building2 size={17} /></span><span className="kpi-trend trend-neutral">SPPG</span></div>
                <p className="kpi-label">Nama SPPG</p>
                <div className="kpi-value" style={{ fontSize: "1.1rem" }}>{me.profile.sppgName}</div>
                <div className="kpi-foot">{me.profile.personInCharge || "—"}</div>
              </article>
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-navy"><Building2 size={17} /></span><span className="kpi-trend trend-neutral">Kapasitas</span></div>
                <p className="kpi-label">Kapasitas SPPG</p>
                <div className="kpi-value">{me.profile.capacity ?? "—"} <span>porsi</span></div>
                <div className="kpi-foot">Per hari</div>
              </article>
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-amber"><Building2 size={17} /></span><span className="kpi-trend trend-neutral">Jam</span></div>
                <p className="kpi-label">Jam Operasional</p>
                <div className="kpi-value" style={{ fontSize: "1.1rem" }}>{me.profile.operationalHours || "—"}</div>
                <div className="kpi-foot">{me.profile.contactPhone || "—"}</div>
              </article>
            </section>
          )}

          {/* Edit Form */}
          {showEdit && (
            <section className="panel" aria-label="Edit profil" style={{ marginBottom: "1rem" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Edit profil SPPG</h2></div>
                  <p>Perbarui informasi SPPG.</p>
                </div>
                <button className="square-button" onClick={() => setShowEdit(false)} aria-label="Tutup form"><X size={16} /></button>
              </div>
              <form onSubmit={handleUpdate} className="trip-form">
                <div className="form-grid">
                  <label>
                    <span>Nama SPPG</span>
                    <input type="text" value={editForm.sppgName} onChange={(e) => setEditForm((f) => ({ ...f, sppgName: e.target.value }))} placeholder="Nama SPPG" />
                  </label>
                  <label>
                    <span>Alamat lengkap</span>
                    <input type="text" value={editForm.fullAddress} onChange={(e) => setEditForm((f) => ({ ...f, fullAddress: e.target.value }))} placeholder="Alamat" />
                  </label>
                  <label>
                    <span>Telepon</span>
                    <input type="text" value={editForm.contactPhone} onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                  </label>
                  <label>
                    <span>Penanggung jawab</span>
                    <input type="text" value={editForm.personInCharge} onChange={(e) => setEditForm((f) => ({ ...f, personInCharge: e.target.value }))} placeholder="Nama penanggung jawab" />
                  </label>
                  <label>
                    <span>Jam operasional</span>
                    <input type="text" value={editForm.operationalHours} onChange={(e) => setEditForm((f) => ({ ...f, operationalHours: e.target.value }))} placeholder="08:00 - 17:00" />
                  </label>
                  <label>
                    <span>Kapasitas (porsi/hari)</span>
                    <input type="number" value={editForm.capacity} onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="0" min="0" />
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span>Catatan</span>
                    <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Catatan tambahan" rows={3} style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "6px" }} />
                  </label>
                </div>
                {formError && <p className="refresh-warning" role="alert">{formError}</p>}
                <div className="page-heading-actions">
                  <button type="button" className="export-button" onClick={() => setShowEdit(false)} disabled={submitting}>Batal</button>
                  <button type="submit" className="export-button" disabled={submitting}>
                    <Save size={15} />
                    {submitting ? "Menyimpan…" : "Simpan perubahan"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Profile Detail Card */}
          {me && (
            <section className="panel" aria-label="Detail profil">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Detail Profil SPPG</h2><span className="count-chip">{me.tenantCode}</span></div>
                  <p>Informasi lengkap SPPG tenant.</p>
                </div>
              </div>
              <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                <div className="profile-field">
                  <span className="profile-label">Kode Tenant</span>
                  <span className="profile-value">{me.tenantCode}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Status</span>
                  <span className="profile-value">{me.status}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Nama SPPG</span>
                  <span className="profile-value">{me.profile?.sppgName ?? "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Penanggung Jawab</span>
                  <span className="profile-value">{me.profile?.personInCharge ?? "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Telepon</span>
                  <span className="profile-value">{me.profile?.contactPhone ?? "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Jam Operasional</span>
                  <span className="profile-value">{me.profile?.operationalHours ?? "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Kapasitas</span>
                  <span className="profile-value">{me.profile?.capacity ? `${me.profile.capacity} porsi/hari` : "—"}</span>
                </div>
                <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="profile-label">Alamat</span>
                  <span className="profile-value">{me.profile?.fullAddress ?? "—"}</span>
                </div>
                {me.profile?.notes && (
                  <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="profile-label">Catatan</span>
                    <span className="profile-value">{me.profile.notes}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta</span>
          </footer>
        </main>
      </section>
    </div>
  );
}