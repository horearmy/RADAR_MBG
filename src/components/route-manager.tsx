"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Crosshair, MapPinned } from "lucide-react";
import {
  archiveRoute,
  createRoute,
  getRoutes,
  type DeliveryLocationOption,
  type RouteSummary,
  type SppgSummary,
} from "@/lib/api";

export function RouteManager({
  sppgs,
  deliveryLocations,
  drawRoute,
  setDrawRoute,
  routePoints,
  setRoutePoints,
  onSelectRoute,
}: {
  sppgs: SppgSummary[];
  deliveryLocations: DeliveryLocationOption[];
  drawRoute: boolean;
  setDrawRoute: (updater: boolean | ((prev: boolean) => boolean)) => void;
  routePoints: Array<{ latitude: number; longitude: number }>;
  setRoutePoints: (updater: Array<{ latitude: number; longitude: number }> | ((prev: Array<{ latitude: number; longitude: number }>) => Array<{ latitude: number; longitude: number }>)) => void;
  onSelectRoute: (coords: Array<{ latitude: number; longitude: number }>) => void;
}) {
  const [routeName, setRouteName] = useState("");
  const [routeSppgId, setRouteSppgId] = useState("");
  const [routeDeliveryLocationId, setRouteDeliveryLocationId] = useState("");
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeNotice, setRouteNotice] = useState("");

  async function loadRoutes() {
    setRoutesLoading(true);
    try {
      const r = await getRoutes({ page: 1, pageSize: 50 });
      setRoutes(r.data);
    } catch {
      setRouteError("Daftar rute gagal dimuat.");
    } finally {
      setRoutesLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!routeName.trim() || !routeSppgId || !routeDeliveryLocationId || routePoints.length < 2) return;
    setRouteSaving(true);
    setRouteError("");
    setRouteNotice("");
    try {
      const result = await createRoute({
        name: routeName.trim(),
        sppgId: routeSppgId,
        deliveryLocationId: routeDeliveryLocationId,
        coordinates: routePoints,
        reason: "Pembuatan rute operasional",
      });
      setRouteNotice(result.replayed ? "Rute sebelumnya sudah tersimpan." : `Rute tersimpan sebagai versi ${result.route.version}.`);
      setRouteName("");
      setRoutePoints([]);
      setDrawRoute(false);
      setRouteSppgId("");
      setRouteDeliveryLocationId("");
      await loadRoutes();
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : "Rute gagal disimpan.");
    } finally {
      setRouteSaving(false);
    }
  }

  // load on mount
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRoutes(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="panel geofence-history" aria-label="Rute operasional">
      <div className="geofence-history-heading">
        <div><h2>Rute operasional</h2><p>Buat dan kelola rute dari SPPG ke lokasi penyaluran. Rute tersimpan sebagai polyline dan dapat ditampilkan di peta.</p></div>
        <span>{routes.length} rute</span>
      </div>
      {routeError && <div className="approval-error" role="alert">{routeError}</div>}
      {routeNotice && <div className="approval-notice" role="status">{routeNotice}</div>}
      <form className="geofence-form" onSubmit={submit} style={{ maxHeight: "none", overflow: "visible" }}>
        <div className="geofence-form-section">
          <h3 className="geofence-form-section-title"><MapPinned size={14} /> Buat Rute</h3>
          <label className="geofence-field"><span>Nama rute</span><input autoComplete="off" maxLength={160} minLength={3} onChange={(event) => setRouteName(event.target.value)} placeholder="Contoh: Rute Cakung" required value={routeName} /></label>
          <div className="geofence-coordinate-grid">
            <label className="geofence-field"><span>SPPG asal</span><select onChange={(event) => setRouteSppgId(event.target.value)} required value={routeSppgId}><option value="">Pilih SPPG</option>{sppgs.filter((s) => s.status === "ACTIVE").map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}</select></label>
            <label className="geofence-field"><span>Lokasi penyaluran</span><select onChange={(event) => setRouteDeliveryLocationId(event.target.value)} required value={routeDeliveryLocationId}><option value="">Pilih lokasi</option>{deliveryLocations.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}</select></label>
          </div>
          <div className="geofence-coordinate-heading"><strong>Titik rute</strong><button className={`geofence-pick-button ${drawRoute ? "active" : ""}`} onClick={() => setDrawRoute((v) => !v)} type="button" aria-pressed={drawRoute}><Crosshair size={14} />{drawRoute ? "Klik peta menambah titik" : "Gambar rute di peta"}</button></div>
          <p className="geofence-address">{routePoints.length} titik, minimal 2 titik.</p>
          {routePoints.length > 0 && <div className="geofence-polygon-list">{routePoints.map((p, i) => <span key={`${p.longitude}-${p.latitude}-${i}`}>{i + 1}: {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</span>)}</div>}
          <div className="geofence-polygon-actions">
            <button className="geofence-pick-button" disabled={!routePoints.length} onClick={() => setRoutePoints((pts) => pts.slice(0, -1))} type="button">Hapus titik terakhir</button>
            <button className="geofence-pick-button" disabled={!routePoints.length} onClick={() => setRoutePoints([])} type="button">Hapus semua</button>
          </div>
          <div className="geofence-form-actions">
            <button className="geofence-reset-button" onClick={() => { setRouteName(""); setRoutePoints([]); setDrawRoute(false); setRouteSppgId(""); setRouteDeliveryLocationId(""); }} type="button">Reset</button>
            <button className="approval-button approve geofence-submit" disabled={routeSaving || !routeName.trim() || !routeSppgId || !routeDeliveryLocationId || routePoints.length < 2} type="submit">{routeSaving ? "Menyimpan..." : "Simpan rute"}</button>
          </div>
        </div>
      </form>
      {routesLoading ? <div className="approval-empty"><span className="session-spinner" /><span>Memuat rute...</span></div> : routes.length ? (
        <div className="geofence-history-list">{routes.map((route) => (
          <div className="geofence-history-item" key={route.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '8px', alignItems: 'center' }}>
            <span className="geofence-history-icon active"><MapPinned size={16} /></span>
            <button className="geofence-history-edit" onClick={() => onSelectRoute(route.coordinates.map((c) => ({ longitude: Number(c.longitude), latitude: Number(c.latitude) })))} style={{ background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }} type="button">
              <div className="geofence-history-copy"><strong>{route.name}</strong><span>{route.sppg?.name ?? route.sppgId} to {route.deliveryLocation?.name ?? route.deliveryLocationId} - {route.distanceMeters ? Number(route.distanceMeters).toLocaleString('id-ID') + ' m' : 'jarak n/a'} - v{route.version}</span></div>
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="geofence-pick-button" onClick={() => onSelectRoute(route.coordinates.map((c) => ({ longitude: Number(c.longitude), latitude: Number(c.latitude) })))} type="button">Lihat</button>
              {route.active && <button className="geofence-pick-button" onClick={async () => { if (!confirm('Nonaktifkan rute ini?')) return; try { await archiveRoute(route.id, 'Nonaktifkan rute'); await loadRoutes(); } catch (e) { alert(e instanceof Error ? e.message : 'Gagal'); } }} type="button">Nonaktifkan</button>}
            </div>
          </div>
        ))}</div>
      ) : <div className="approval-empty"><MapPinned size={20} /><strong>Belum ada rute tersimpan</strong><span>Buat rute menggunakan form di atas.</span></div>}
    </section>
  );
}