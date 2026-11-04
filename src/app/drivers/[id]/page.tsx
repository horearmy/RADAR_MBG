"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Car,
  ClipboardList,
  Edit,
  History,
  MapPin,
  RefreshCw,
  Truck,
  User,
  Users,
} from "lucide-react";
import { getCurrentSession, hasPermission, apiBaseUrl, apiFetchUrl, type SessionUser } from "@/lib/api";
import { AssignmentModal } from "@/components/assignment-modal";

const apiBase = apiBaseUrl;

type TabKey = "ringkasan" | "penugasan" | "riwayat" | "kendaraan" | "dokumen" | "riwayat-perubahan";

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  } catch {
    return iso;
  }
}

function statusPill(status: string) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return <span className="pill pill-active">Aktif</span>;
  if (s === "SUSPENDED") return <span className="pill pill-warning">Ditangguhkan</span>;
  if (s === "INACTIVE") return <span className="pill pill-neutral">Nonaktif</span>;
  return <span className="pill pill-neutral">{status}</span>;
}

function DriverDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driver, setDriver] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [tab, setTab] = useState<TabKey>("ringkasan");
  const [assignOpen, setAssignOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const [driverRes, assignRes, vehicleRes] = await Promise.all([
        apiFetchUrl(`${apiBase}/admin/drivers/${encodeURIComponent(params.id)}`, { credentials: "include", cache: "no-store" }),
        apiFetchUrl(`${apiBase}/admin/assignments?page=1&pageSize=100&driverId=${encodeURIComponent(params.id)}`, { credentials: "include", cache: "no-store" }),
        apiFetchUrl(`${apiBase}/admin/vehicles?page=1&pageSize=100`, { credentials: "include", cache: "no-store" }),
      ]);
      if (driverRes.ok) {
        setDriver(await driverRes.json());
      } else throw new Error("Gagal memuat driver");
      if (assignRes.ok) {
        const json = await assignRes.json();
        setAssignments(json.data ?? []);
      }
      if (vehicleRes.ok) setVehicles((await vehicleRes.json()).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail driver");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeAssignment = useMemo(() => assignments.find((a) => !a.effectiveTo), [assignments]);
  const assignedVehicle = useMemo(() => {
    if (!activeAssignment) return null;
    return vehicles.find((v) => v.id === activeAssignment.vehicleId);
  }, [activeAssignment, vehicles]);

  async function endAssignment() {
    if (!activeAssignment) return;
    const reason = prompt("Alasan mengakhiri penugasan (minimal 3 karakter):");
    if (!reason || reason.trim().length < 3) return;
    setEnding(true);
    try {
      const csrfRes = await apiFetchUrl(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const res = await apiFetchUrl(`${apiBase}/admin/assignments/${activeAssignment.id}/end`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ effectiveTo: new Date().toISOString(), reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Gagal mengakhiri penugasan");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengakhiri penugasan");
    } finally {
      setEnding(false);
    }
  }

  if (user && !hasPermission(user, "master:read") && !hasPermission(user, "admin:manage_users")) {
    return (
      <main className="page">
        <header className="page-header"><div><h1 className="page-title">Detail Driver</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-hero">
        <div className="page-hero-content">
          <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Driver &gt; {driver?.code ?? params.id}</p>
          <div className="page-hero-title-row">
            <div className="page-hero-icon"><Users size={20} /></div>
            <div>
              <h1 className="page-title">{driver?.name ?? "Detail Driver"}</h1>
              <p className="page-subtitle">Profil, status akun, kesiapan bertugas, penugasan kendaraan, riwayat perjalanan, dan jejak perubahan driver.</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push("/drivers")}><ArrowLeft size={16} /> Kembali</button>
          <button className="btn btn-ghost" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Muat ulang</button>
          {hasPermission(user!, "master:manage") && (
            activeAssignment ? (
              <button className="btn btn-ghost" onClick={endAssignment} disabled={ending}><Car size={16} /> {ending ? "Mengakhiri..." : "Akhiri Penugasan"}</button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setAssignOpen(true)}><Car size={16} /> Atur Penugasan</button>
            )
          )}
          {hasPermission(user!, "master:manage") && <Link className="btn btn-primary" href={`/drivers/${params.id}/edit`}><Edit size={16} /> Edit Driver</Link>}
        </div>
      </header>

      {loading && <div className="panel"><p className="text-secondary">Memuat detail driver...</p></div>}
      {error && <div className="panel"><p className="text-danger">{error}</p></div>}
      {!loading && !error && driver && (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Status Akun</span><User size={18} /></div>
              <div style={{ marginTop: 8 }}>{statusPill(driver.status)}</div>
              <p className="kpi-subtitle">Status akun</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Ketersediaan</span><ClipboardList size={18} /></div>
              <div style={{ marginTop: 8 }}>{driver.status?.toUpperCase() === "ACTIVE" ? <span className="pill pill-active">Siap Bertugas</span> : <span className="pill pill-neutral">Tidak Tersedia</span>}</div>
              <p className="kpi-subtitle">Berdasarkan status akun</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Tugas Aktif</span><MapPin size={18} /></div>
              <div className="kpi-value">0</div>
              <p className="kpi-subtitle">Perjalanan aktif</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Kendaraan</span><Car size={18} /></div>
              <div className="kpi-value">{assignedVehicle ? 1 : 0}</div>
              <p className="kpi-subtitle">{assignedVehicle ? assignedVehicle.plateNumber : "Belum ditugaskan"}</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">SPPG</span><Truck size={18} /></div>
              <div className="kpi-value" style={{ fontSize: 16 }}>{driver.sppg?.name ?? "-"}</div>
              <p className="kpi-subtitle">{driver.sppg?.code ?? ""}</p>
            </article>
          </section>

          <section className="panel">
            <div className="tab-list">
              <button className={`tab ${tab === "ringkasan" ? "active" : ""}`} onClick={() => setTab("ringkasan")}>Ringkasan</button>
              <button className={`tab ${tab === "penugasan" ? "active" : ""}`} onClick={() => setTab("penugasan")}>Penugasan</button>
              <button className={`tab ${tab === "riwayat" ? "active" : ""}`} onClick={() => setTab("riwayat")}>Riwayat Perjalanan</button>
              <button className={`tab ${tab === "kendaraan" ? "active" : ""}`} onClick={() => setTab("kendaraan")}>Kendaraan</button>
              <button className={`tab ${tab === "dokumen" ? "active" : ""}`} onClick={() => setTab("dokumen")}>Dokumen</button>
              <button className={`tab ${tab === "riwayat-perubahan" ? "active" : ""}`} onClick={() => setTab("riwayat-perubahan")}>Riwayat Perubahan</button>
            </div>

            {tab === "ringkasan" && (
              <div className="detail-grid">
                <div className="detail-card">
                  <h3>Identitas Driver</h3>
                  <dl className="detail-list">
                    <div><dt>ID Driver</dt><dd className="mono">{driver.code}</dd></div>
                    <div><dt>Nama</dt><dd>{driver.name}</dd></div>
                    <div><dt>Kontak</dt><dd>{driver.phone ?? "-"}</dd></div>
                    <div><dt>SPPG</dt><dd>{driver.sppg?.name ?? "-"}</dd></div>
                    <div><dt>User Akun</dt><dd>{driver.user?.username ?? driver.userId ?? "-"}</dd></div>
                    <div><dt>Status Akun</dt><dd>{statusPill(driver.status)}</dd></div>
                  </dl>
                </div>
                <div className="detail-card">
                  <h3>Kesiapan & Penugasan</h3>
                  <dl className="detail-list">
                    <div><dt>Ketersediaan</dt><dd>{driver.status?.toUpperCase() === "ACTIVE" ? "Siap Bertugas" : "Tidak Tersedia"}</dd></div>
                    <div><dt>Kendaraan Ditugaskan</dt><dd>{assignedVehicle ? `${assignedVehicle.plateNumber}${assignedVehicle.label ? ` • ${assignedVehicle.label}` : ""}` : "-"}</dd></div>
                    <div><dt>Penugasan Aktif</dt><dd>{activeAssignment ? "Ya" : "Tidak"}</dd></div>
                    <div><dt>Diperbarui</dt><dd>{formatDate(driver.updatedAt)}</dd></div>
                  </dl>
                </div>
              </div>
            )}

            {tab === "penugasan" && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Kendaraan</th><th>SPPG</th><th>Berlaku Dari</th><th>Berlaku Sampai</th><th>Alasan</th><th>Status</th></tr></thead>
                  <tbody>
                    {assignments.length === 0 && <tr><td colSpan={6} className="empty-row">Belum ada penugasan</td></tr>}
                    {assignments.map((a) => (
                      <tr key={a.id}>
                        <td>{a.vehicle?.plateNumber ?? a.vehicleId}</td>
                        <td>{a.sppg?.name ?? a.sppgId}</td>
                        <td className="text-muted">{formatDate(a.effectiveFrom)}</td>
                        <td className="text-muted">{a.effectiveTo ? formatDate(a.effectiveTo) : "Aktif"}</td>
                        <td>{a.reason}</td>
                        <td>{a.effectiveTo ? <span className="pill pill-neutral">Berakhir</span> : <span className="pill pill-active">Aktif</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "riwayat" && <div className="empty-state"><History size={18} /><p>Riwayat perjalanan sesuai izin akan ditampilkan</p></div>}
            {tab === "kendaraan" && (
              <div className="detail-card">
                <h3>Kendaraan Terkait</h3>
                {assignedVehicle ? (
                  <dl className="detail-list">
                    <div><dt>Plat Nomor</dt><dd className="mono">{assignedVehicle.plateNumber}</dd></div>
                    <div><dt>Label</dt><dd>{assignedVehicle.label ?? "-"}</dd></div>
                    <div><dt>Status</dt><dd>{statusPill(assignedVehicle.status)}</dd></div>
                    <div><dt>Kapasitas</dt><dd>{assignedVehicle.capacity ?? "-"}</dd></div>
                  </dl>
                ) : <p className="text-muted">Belum ada kendaraan yang ditugaskan saat ini.</p>}
              </div>
            )}
            {tab === "dokumen" && <div className="empty-state"><History size={18} /><p>Dokumen & masa berlaku dapat dikonfigurasi sesuai kebijakan</p></div>}
            {tab === "riwayat-perubahan" && <div className="empty-state"><History size={18} /><p>Riwayat perubahan akan tersedia berdasarkan audit trail</p></div>}
          </section>
        </>
      )}
      {driver && (
        <AssignmentModal
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          onSuccess={load}
          sppgId={driver.sppgId}
          driverId={driver.id}
          driverName={driver.name}
          vehicles={vehicles}
        />
      )}
    </main>
  );
}

export default function DriverDetailPage() {
  return (
    <Suspense fallback={<main className="page"><header className="page-hero"><div className="page-hero-content"><h1 className="page-title">Detail Driver</h1></div></header><div className="panel"><p className="text-secondary">Memuat...</p></div></main>}>
      <DriverDetailContent />
    </Suspense>
  );
}
