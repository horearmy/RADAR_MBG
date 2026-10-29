"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Car, Edit, RefreshCw, Truck, Users } from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

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
  if (s === "MAINTENANCE") return <span className="pill pill-warning">Perawatan</span>;
  if (s === "INACTIVE") return <span className="pill pill-neutral">Nonaktif</span>;
  return <span className="pill pill-neutral">{status}</span>;
}

function VehicleDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const [vehRes, driverRes] = await Promise.all([
        fetch(`${apiBase}/admin/vehicles?page=1&pageSize=100`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/admin/drivers?page=1&pageSize=100`, { credentials: "include", cache: "no-store" }),
      ]);
      if (vehRes.ok) {
        const json = await vehRes.json();
        const found = (json.data ?? []).find((x: any) => x.id === params.id);
        if (!found) throw new Error("Kendaraan tidak ditemukan");
        setVehicle(found);
      } else throw new Error("Gagal memuat kendaraan");
      if (driverRes.ok) {
        const json = await driverRes.json();
        setDrivers(json.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail kendaraan");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (user && !hasPermission(user, "master:read")) {
    return (
      <main className="page">
        <header className="page-hero"><div className="page-hero-content"><h1 className="page-title">Detail Kendaraan</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-hero">
        <div className="page-hero-content">
          <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Kendaraan &gt; {vehicle?.plateNumber ?? params.id}</p>
          <div className="page-hero-title-row">
            <div className="page-hero-icon"><Truck size={20} /></div>
            <div>
              <h1 className="page-title">{vehicle?.plateNumber ?? "Detail Kendaraan"}</h1>
              <p className="page-subtitle">Informasi armada, pemilik SPPG, status operasional, dan relasi dengan driver.</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push("/vehicles")}><ArrowLeft size={16} /> Kembali</button>
          <button className="btn btn-ghost" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Muat ulang</button>
          {hasPermission(user!, "master:manage") && <Link className="btn btn-primary" href={`/vehicles/${params.id}/edit`}><Edit size={16} /> Edit Kendaraan</Link>}
        </div>
      </header>

      {loading && <div className="panel"><div className="table-state">Memuat detail kendaraan...</div></div>}
      {error && <div className="panel"><div className="table-state error">{error}</div></div>}
      {!loading && !error && vehicle && (
        <>
          <section className="kpi-grid kpi-grid-4">
            <article className="kpi-card kpi-card-enhanced">
              <div className="kpi-header"><div className="kpi-icon-wrap kpi-icon-blue"><Car size={18} /></div><span className="kpi-label">Status</span></div>
              <div className="kpi-value-row"><div style={{ marginTop: 6 }}>{statusPill(vehicle.status)}</div></div>
              <p className="kpi-subtitle">Status operasional</p>
            </article>
            <article className="kpi-card kpi-card-enhanced">
              <div className="kpi-header"><div className="kpi-icon-wrap kpi-icon-navy"><Truck size={18} /></div><span className="kpi-label">Kapasitas</span></div>
              <div className="kpi-value-row"><div className="kpi-value">{vehicle.capacity ?? "-"}</div></div>
              <p className="kpi-subtitle">Porsi per perjalanan</p>
            </article>
            <article className="kpi-card kpi-card-enhanced">
              <div className="kpi-header"><div className="kpi-icon-wrap kpi-icon-green"><Users size={18} /></div><span className="kpi-label">Driver Terkait</span></div>
              <div className="kpi-value-row"><div className="kpi-value">{drivers.filter((d) => d.sppgId === vehicle.sppgId).length}</div></div>
              <p className="kpi-subtitle">Dalam SPPG yang sama</p>
            </article>
            <article className="kpi-card kpi-card-enhanced">
              <div className="kpi-header"><div className="kpi-icon-wrap kpi-icon-amber"><Truck size={18} /></div><span className="kpi-label">SPPG</span></div>
              <div className="kpi-value-row"><div style={{ marginTop: 4, fontWeight: 600 }}>{vehicle.sppg?.name ?? "-"}</div></div>
              <p className="kpi-subtitle">{vehicle.sppg?.code ?? ""}</p>
            </article>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 13 }}>Informasi Kendaraan</h2>
                <p style={{ margin: "4px 0 0", color: "#8592a2", fontSize: 11 }}>Data identitas dan status armada</p>
              </div>
            </div>
            <div className="detail-grid" style={{ paddingTop: 0 }}>
              <div className="detail-card" style={{ marginTop: 16 }}>
                <h3>Identitas</h3>
                <dl className="detail-list">
                  <div><dt>Plat Nomor</dt><dd className="mono">{vehicle.plateNumber}</dd></div>
                  <div><dt>Label</dt><dd>{vehicle.label ?? "-"}</dd></div>
                  <div><dt>Kapasitas</dt><dd>{vehicle.capacity ? `${vehicle.capacity} porsi` : "-"}</dd></div>
                  <div><dt>Status</dt><dd>{statusPill(vehicle.status)}</dd></div>
                </dl>
              </div>
              <div className="detail-card" style={{ marginTop: 16 }}>
                <h3>Asal & Pembaruan</h3>
                <dl className="detail-list">
                  <div><dt>SPPG</dt><dd>{vehicle.sppg?.name ?? "-"}</dd></div>
                  <div><dt>Kode SPPG</dt><dd className="mono">{vehicle.sppg?.code ?? "-"}</dd></div>
                  <div><dt>Dibuat</dt><dd>{formatDate(vehicle.createdAt)}</dd></div>
                  <div><dt>Diperbarui</dt><dd>{formatDate(vehicle.updatedAt)}</dd></div>
                </dl>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default function VehicleDetailPage() {
  return (
    <Suspense fallback={<main className="page"><header className="page-hero"><div className="page-hero-content"><h1 className="page-title">Detail Kendaraan</h1></div></header><div className="panel"><div className="table-state">Memuat...</div></div></main>}>
      <VehicleDetailContent />
    </Suspense>
  );
}
