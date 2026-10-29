"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Car,
  Edit,
  History,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

type TabKey = "ringkasan" | "distribusi" | "driver-kendaraan" | "lokasi" | "alert" | "riwayat";

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
  if (s === "PENDING") return <span className="pill pill-warning">Menunggu Persetujuan</span>;
  if (s === "SUSPENDED") return <span className="pill pill-warning">Perlu Perhatian</span>;
  if (s === "INACTIVE" || s === "ARCHIVED") return <span className="pill pill-neutral">Nonaktif</span>;
  return <span className="pill pill-neutral">{status}</span>;
}

export default function SppgDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sppg, setSppg] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [tab, setTab] = useState<TabKey>("ringkasan");

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const [sppgRes, driverRes, vehicleRes, tripRes] = await Promise.all([
        fetch(`${apiBase}/admin/sppg?page=1&pageSize=100`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/admin/drivers?page=1&pageSize=100&sppgId=${params.id}`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/admin/vehicles?page=1&pageSize=100&sppgId=${params.id}`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/trips?page=1&pageSize=20`, { credentials: "include", cache: "no-store" }),
      ]);
      if (sppgRes.ok) {
        const json = await sppgRes.json();
        const found = (json.data ?? []).find((x: any) => x.id === params.id);
        if (!found) throw new Error("SPPG tidak ditemukan");
        setSppg(found);
      } else throw new Error("Gagal memuat SPPG");
      if (driverRes.ok) {
        const json = await driverRes.json();
        setDrivers(json.data ?? []);
      }
      if (vehicleRes.ok) {
        const json = await vehicleRes.json();
        setVehicles(json.data ?? []);
      }
      if (tripRes.ok) {
        const json = await tripRes.json();
        const list = (json.data ?? []).filter((t: any) => t.sppg?.id === params.id);
        setTrips(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail SPPG");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tripToday = useMemo(() => trips.length, [trips]);

  if (user && !hasPermission(user, "master:read") && !hasPermission(user, "sppg:read")) {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <p className="page-breadcrumb">Operasional &gt; SPPG &gt; Detail</p>
            <h1 className="page-title">Detail SPPG</h1>
          </div>
        </header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-hero">
        <div className="page-hero-content">
          <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; SPPG &gt; {sppg?.code ?? params.id}</p>
          <div className="page-hero-title-row">
            <div className="page-hero-icon"><MapPin size={20} /></div>
            <div>
              <h1 className="page-title">{sppg?.name ?? "Detail SPPG"}</h1>
              <p className="page-subtitle">Profil, lokasi, status operasional, relasi driver & kendaraan, aktivitas distribusi, dan jejak perubahan unit SPPG.</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push("/sppg")}><ArrowLeft size={16} /> Kembali</button>
          <button className="btn btn-ghost" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Muat ulang</button>
          <Link className="btn btn-primary" href={`/sppg/${params.id}/edit`}><Edit size={16} /> Edit SPPG</Link>
        </div>
      </header>

      {loading && <div className="panel"><p className="text-secondary">Memuat detail SPPG...</p></div>}
      {error && <div className="panel"><p className="text-danger">{error}</p></div>}
      {!loading && !error && sppg && (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Status</span><MapPin size={18} /></div>
              <div style={{ marginTop: 8 }}>{statusPill(sppg.status)}</div>
              <p className="kpi-subtitle">Status operasional</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Driver</span><Users size={18} /></div>
              <div className="kpi-value">{drivers.length}</div>
              <p className="kpi-subtitle">Driver terdaftar</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Kendaraan</span><Truck size={18} /></div>
              <div className="kpi-value">{vehicles.length}</div>
              <p className="kpi-subtitle">Kendaraan terdaftar</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Distribusi Hari Ini</span><Navigation size={18} /></div>
              <div className="kpi-value">{tripToday}</div>
              <p className="kpi-subtitle">Perjalanan terkait</p>
            </article>
            <article className="kpi-card">
              <div className="kpi-header"><span className="kpi-label">Alert</span><Bell size={18} /></div>
              <div className="kpi-value">0</div>
              <p className="kpi-subtitle">Terbuka</p>
            </article>
          </section>

          <section className="panel">
            <div className="tab-list">
              <button className={`tab ${tab === "ringkasan" ? "active" : ""}`} onClick={() => setTab("ringkasan")}>Ringkasan</button>
              <button className={`tab ${tab === "distribusi" ? "active" : ""}`} onClick={() => setTab("distribusi")}>Distribusi</button>
              <button className={`tab ${tab === "driver-kendaraan" ? "active" : ""}`} onClick={() => setTab("driver-kendaraan")}>Driver & Kendaraan</button>
              <button className={`tab ${tab === "lokasi" ? "active" : ""}`} onClick={() => setTab("lokasi")}>Lokasi & Geofence</button>
              <button className={`tab ${tab === "alert" ? "active" : ""}`} onClick={() => setTab("alert")}>Alert</button>
              <button className={`tab ${tab === "riwayat" ? "active" : ""}`} onClick={() => setTab("riwayat")}>Riwayat Perubahan</button>
            </div>

            {tab === "ringkasan" && (
              <div className="detail-grid">
                <div className="detail-card">
                  <h3>Identitas SPPG</h3>
                  <dl className="detail-list">
                    <div><dt>Kode</dt><dd className="mono">{sppg.code}</dd></div>
                    <div><dt>Nama</dt><dd>{sppg.name}</dd></div>
                    <div><dt>Organisasi</dt><dd>{sppg.organization?.name ?? sppg.organizationId}</dd></div>
                    <div><dt>Wilayah</dt><dd>{sppg.region?.name ?? sppg.regionId}</dd></div>
                    <div><dt>Status</dt><dd>{statusPill(sppg.status)}</dd></div>
                    <div><dt>Versi</dt><dd>{sppg.version ?? "-"}</dd></div>
                  </dl>
                </div>
                <div className="detail-card">
                  <h3>Lokasi</h3>
                  <dl className="detail-list">
                    <div><dt>Alamat</dt><dd>{sppg.address ?? "-"}</dd></div>
                    <div><dt>Latitude</dt><dd>{sppg.latitude ?? "-"}</dd></div>
                    <div><dt>Longitude</dt><dd>{sppg.longitude ?? "-"}</dd></div>
                    <div><dt>Diperbarui</dt><dd>{formatDate(sppg.updatedAt)}</dd></div>
                  </dl>
                </div>
              </div>
            )}

            {tab === "distribusi" && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>ID Perjalanan</th><th>Status</th><th>Tujuan</th><th>Driver</th><th>Waktu</th></tr></thead>
                  <tbody>
                    {trips.length === 0 && <tr><td colSpan={5} className="empty-row">Belum ada perjalanan terkait</td></tr>}
                    {trips.map((t: any) => (
                      <tr key={t.id}>
                        <td className="mono">{t.id.slice(0, 8)}</td>
                        <td><span className="pill pill-neutral">{t.status}</span></td>
                        <td>{t.deliveryLocation?.name ?? "-"}</td>
                        <td>{t.driver?.name ?? "-"}</td>
                        <td className="text-muted">{formatDate(t.plannedDepartureAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "driver-kendaraan" && (
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="card-header-row"><h3>Driver</h3><Link className="btn btn-ghost btn-sm" href="/drivers"><Users size={14} /> Lihat semua</Link></div>
                  <div className="table-wrapper compact">
                    <table className="data-table">
                      <thead><tr><th>Driver</th><th>Kode</th><th>Status</th><th>Kontak</th></tr></thead>
                      <tbody>
                        {drivers.length === 0 && <tr><td colSpan={4} className="empty-row">Tidak ada driver</td></tr>}
                        {drivers.map((d) => (
                          <tr key={d.id}><td>{d.name}</td><td className="mono">{d.code}</td><td>{statusPill(d.status)}</td><td>{d.phone ?? "-"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="detail-card">
                  <div className="card-header-row"><h3>Kendaraan</h3><Link className="btn btn-ghost btn-sm" href="/vehicles"><Car size={14} /> Lihat semua</Link></div>
                  <div className="table-wrapper compact">
                    <table className="data-table">
                      <thead><tr><th>Plat Nomor</th><th>Label</th><th>Status</th><th>Kapasitas</th></tr></thead>
                      <tbody>
                        {vehicles.length === 0 && <tr><td colSpan={4} className="empty-row">Tidak ada kendaraan</td></tr>}
                        {vehicles.map((v) => (
                          <tr key={v.id}><td className="mono">{v.plateNumber}</td><td>{v.label ?? "-"}</td><td>{statusPill(v.status)}</td><td>{v.capacity ?? "-"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "lokasi" && (
              <div className="detail-card">
                <h3>Lokasi & Geofence</h3>
                <dl className="detail-list">
                  <div><dt>Alamat</dt><dd>{sppg.address ?? "-"}</dd></div>
                  <div><dt>Koordinat</dt><dd>{sppg.latitude && sppg.longitude ? `${sppg.latitude}, ${sppg.longitude}` : "-"}</dd></div>
                </dl>
                <p className="text-muted">Integrasi peta & geofence dapat dilanjutkan melalui modul Geofence.</p>
              </div>
            )}

            {tab === "alert" && (
              <div className="empty-state"><Bell size={18} /><p>Tidak ada alert terbuka</p></div>
            )}

            {tab === "riwayat" && (
              <div className="empty-state"><History size={18} /><p>Riwayat perubahan akan tersedia berdasarkan audit trail</p></div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
