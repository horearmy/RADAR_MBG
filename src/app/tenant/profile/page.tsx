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
                <button className="trip-create-trigger" onClick={startEdit}>
                  <Pencil size={14} />
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
            <div className="trip-modal-backdrop" onClick={() => !submitting && setShowEdit(false)}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
                <button className="trip-modal-close" onClick={() => setShowEdit(false)} disabled={submitting} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h2 id="edit-profile-title">Edit profil SPPG</h2>
                    <p>Perbarui informasi SPPG tenant.</p>
                  </div>
                </div>
                <form onSubmit={handleUpdate} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M3 21h18"></path>
                          <path d="M5 21V7l8-4v18"></path>
                          <path d="M19 21V11l-6-4"></path>
                        </svg>
                        Nama SPPG
                      </span>
                      <input type="text" value={editForm.sppgName} onChange={(e) => setEditForm((f) => ({ ...f, sppgName: e.target.value }))} placeholder="Nama SPPG" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        Alamat lengkap
                      </span>
                      <input type="text" value={editForm.fullAddress} onChange={(e) => setEditForm((f) => ({ ...f, fullAddress: e.target.value }))} placeholder="Alamat" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Telepon
                      </span>
                      <input type="text" value={editForm.contactPhone} onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Penanggung jawab
                      </span>
                      <input type="text" value={editForm.personInCharge} onChange={(e) => setEditForm((f) => ({ ...f, personInCharge: e.target.value }))} placeholder="Nama penanggung jawab" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Jam operasional
                      </span>
                      <input type="text" value={editForm.operationalHours} onChange={(e) => setEditForm((f) => ({ ...f, operationalHours: e.target.value }))} placeholder="08:00 - 17:00" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        Kapasitas (porsi/hari)
                      </span>
                      <input type="number" value={editForm.capacity} onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="0" min="0" />
                    </div>
                    <div className="trip-form-field" style={{ gridColumn: "1 / -1" }}>
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        Catatan
                      </span>
                      <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Catatan tambahan" rows={3} style={{ width: "100%", padding: "9px 10px", border: "1px solid #dbe4ee", borderRadius: "7px", fontSize: "10px", fontFamily: "inherit", resize: "vertical", minHeight: "80px" }} />
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
                    <button type="button" className="trip-action-button muted" onClick={() => setShowEdit(false)} disabled={submitting}>
                      Batal
                    </button>
                    <button type="submit" className="trip-action-button primary" disabled={submitting}>
                      {submitting ? "Menyimpan..." : "Simpan perubahan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
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
              <div style={{ padding: "16px" }}>
                <dl className="detail-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", margin: 0 }}>
                  <div>
                    <dt>Kode Tenant</dt>
                    <dd>{me.tenantCode}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{me.status}</dd>
                  </div>
                  <div>
                    <dt>Nama SPPG</dt>
                    <dd>{me.profile?.sppgName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Penanggung Jawab</dt>
                    <dd>{me.profile?.personInCharge ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Telepon</dt>
                    <dd>{me.profile?.contactPhone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Jam Operasional</dt>
                    <dd>{me.profile?.operationalHours ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Kapasitas</dt>
                    <dd>{me.profile?.capacity ? `${me.profile.capacity} porsi/hari` : "—"}</dd>
                  </div>
                  <div>
                    <dt>Alamat</dt>
                    <dd>{me.profile?.fullAddress ?? "—"}</dd>
                  </div>
                  {me.profile?.notes && (
                    <div>
                      <dt>Catatan</dt>
                      <dd>{me.profile.notes}</dd>
                    </div>
                  )}
                </dl>
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