"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleDot, Clock3, Crosshair, MapPinned, Plus, RefreshCw, Save, ShieldCheck, Utensils } from "lucide-react";
import { FleetMap } from "@/components/fleet-map";
import { AppSidebar } from "@/components/app-sidebar";
import {
  createGeofence,
  getCurrentSession,
  getDeliveryLocationOptions,
  getGeofences,
  getSppgOptions,
  hasPermission,
  type DeliveryLocationOption,
  type GeofenceLocationType,
  type GeofenceSummary,
  type SessionUser,
  type SppgSummary,
} from "@/lib/api";

type LocationOption = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  active: boolean;
};

function mapSppg(sppg: SppgSummary): LocationOption {
  return {
    id: sppg.id,
    code: sppg.code,
    name: sppg.name,
    address: sppg.address,
    latitude: sppg.latitude,
    longitude: sppg.longitude,
    active: sppg.status === "ACTIVE",
  };
}

function mapDeliveryLocation(location: DeliveryLocationOption): LocationOption {
  return { ...location, active: location.active };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "REQUEST_FAILED_403" || code === "PERMISSION_FORBIDDEN" || code === "SCOPE_FORBIDDEN") {
    return "Akun Anda tidak memiliki izin atau scope untuk lokasi ini.";
  }
  if (code === "SPPG_NOT_ACTIVE") return "Geofence hanya dapat dibuat untuk SPPG aktif.";
  if (code === "REQUEST_FAILED_409" || code === "IDEMPOTENCY_KEY_REUSED") {
    return "Versi geofence berubah atau permintaan tersimpan dengan data berbeda. Muat ulang lalu periksa riwayat.";
  }
  if (code === "UNAUTHENTICATED") return "Sesi berakhir. Silakan masuk kembali.";
  return "Geofence gagal disimpan. Periksa data, koneksi, dan izin akun lalu coba lagi.";
}

export default function GeofencesPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sppgs, setSppgs] = useState<SppgSummary[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocationOption[]>([]);
  const [locationType, setLocationType] = useState<GeofenceLocationType>("SPPG");
  const [shapeType, setShapeType] = useState<"CIRCLE" | "POLYGON">("CIRCLE");
  const [locationId, setLocationId] = useState("");
  const [geofences, setGeofences] = useState<GeofenceSummary[]>([]);
  const [name, setName] = useState("");
  const [centerLatitude, setCenterLatitude] = useState("");
  const [centerLongitude, setCenterLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("");
  const [minGpsAccuracyMeters, setMinGpsAccuracyMeters] = useState("50");
  const [confirmationFixes, setConfirmationFixes] = useState("2");
  const [confirmationDurationSeconds, setConfirmationDurationSeconds] = useState("10");
  const [reason, setReason] = useState("");
  const [pickCenter, setPickCenter] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Array<{ longitude: number; latitude: number }>>([]);
  const [drawPolygon, setDrawPolygon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [geofencesLoading, setGeofencesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const idempotencyKeyRef = useRef<string | null>(null);

  const canManage = user ? hasPermission(user, "geofence:manage") : false;
  const canRead = user ? hasPermission(user, "geofence:read") : false;
  const canReadMaster = user ? hasPermission(user, "master:read") : false;
  const locations = useMemo(() => locationType === "SPPG"
    ? sppgs.map(mapSppg)
    : deliveryLocations.map(mapDeliveryLocation), [deliveryLocations, locationType, sppgs]);
  const selectedLocation = locations.find((location) => location.id === locationId) ?? null;
  const canCreateForLocation = selectedLocation?.active === true;
  const centerLatitudeValue = Number(centerLatitude);
  const centerLongitudeValue = Number(centerLongitude);
  const radiusMetersValue = Number(radiusMeters);
  const hasValidDraft = shapeType === "POLYGON"
    ? polygonPoints.length >= 3
    : (
        centerLatitude.trim() !== "" && centerLongitude.trim() !== "" && radiusMeters.trim() !== "" &&
        Number.isFinite(centerLatitudeValue) && centerLatitudeValue >= -90 && centerLatitudeValue <= 90 &&
        Number.isFinite(centerLongitudeValue) && centerLongitudeValue >= -180 && centerLongitudeValue <= 180 &&
        Number.isFinite(radiusMetersValue) && radiusMetersValue >= 10 && radiusMetersValue <= 10_000
      );
  const draftGeofence = hasValidDraft
    ? { centerLatitude: centerLatitudeValue, centerLongitude: centerLongitudeValue, radiusMeters: radiusMetersValue }
    : null;
  const focusPoint = useMemo(() => selectedLocation && Number.isFinite(Number(selectedLocation.latitude)) && Number.isFinite(Number(selectedLocation.longitude))
    ? { latitude: Number(selectedLocation.latitude), longitude: Number(selectedLocation.longitude) }
    : null, [selectedLocation]);

  const refreshGeofences = useCallback(async (type: GeofenceLocationType, id: string) => {
    if (!user || !hasPermission(user, "geofence:read")) {
      setGeofences([]);
      return;
    }
    setGeofencesLoading(true);
    try {
      setGeofences(await getGeofences(type, id));
    } catch (loadError: unknown) {
      if (loadError instanceof Error && loadError.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setError("Riwayat geofence gagal dimuat. Periksa koneksi atau scope akses lokasi.");
    } finally {
      setGeofencesLoading(false);
    }
  }, [router, user]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const current = await getCurrentSession();
        if (!active) return;
        setUser(current);
        if (!hasPermission(current, "geofence:read") && !hasPermission(current, "geofence:manage")) {
          setLoading(false);
          return;
        }
        if (!hasPermission(current, "master:read")) {
          setLoading(false);
          return;
        }
        const [sppgOptions, deliveryOptions] = await Promise.all([
          getSppgOptions(),
          getDeliveryLocationOptions(),
        ]);
        if (!active) return;
        setSppgs(sppgOptions);
        setDeliveryLocations(deliveryOptions);
        const firstSppg = sppgOptions.find((sppg) => sppg.status === "ACTIVE");
        const firstDelivery = deliveryOptions.find((location) => location.active);
        const first = firstSppg ?? firstDelivery;
        if (first) {
          const type: GeofenceLocationType = firstSppg ? "SPPG" : "DELIVERY";
          setLocationType(type);
          setLocationId(first.id);
          if (first.latitude != null && first.longitude != null) {
            setCenterLatitude(String(first.latitude));
            setCenterLongitude(String(first.longitude));
          }
        }
      } catch (loadError: unknown) {
        if (!active) return;
        if (loadError instanceof Error && loadError.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setError("Daftar lokasi gagal dimuat. Pastikan akun memiliki izin master:read dan API tersedia.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadKey, router]);

  useEffect(() => {
    if (!locationId || !canRead) return;
    const timer = window.setTimeout(() => {
      void refreshGeofences(locationType, locationId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canRead, locationId, locationType, refreshGeofences]);

  function updateLocation(type: GeofenceLocationType, id: string) {
    const source = type === "SPPG" ? sppgs.map(mapSppg) : deliveryLocations.map(mapDeliveryLocation);
    const location = source.find((item) => item.id === id);
    setLocationType(type);
    setLocationId(id);
    setPickCenter(false);
    if (location?.latitude != null && location.longitude != null) {
      setCenterLatitude(String(location.latitude));
      setCenterLongitude(String(location.longitude));
    } else {
      setCenterLatitude("");
      setCenterLongitude("");
    }
  }

  async function submitGeofence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !selectedLocation || !canCreateForLocation || !hasValidDraft) return;
    setSaving(true);
    setError("");
    setNotice("");
    idempotencyKeyRef.current ??= crypto.randomUUID();
    try {
      const result = await createGeofence({
        locationType,
        locationId,
        shapeType,
        name: name.trim(),
        ...(shapeType === "CIRCLE" ? {
          centerLatitude: centerLatitudeValue,
          centerLongitude: centerLongitudeValue,
          radiusMeters: radiusMetersValue,
        } : {}),
        ...(shapeType === "POLYGON" ? {
          polygonCoordinates: polygonPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        } : {}),
        minGpsAccuracyMeters: Number(minGpsAccuracyMeters),
        confirmationFixes: Number(confirmationFixes),
        confirmationDurationSeconds: Number(confirmationDurationSeconds),
        reason: reason.trim(),
      }, idempotencyKeyRef.current);
      idempotencyKeyRef.current = null;
      setNotice(result.replayed
        ? "Permintaan sebelumnya sudah tersimpan. Riwayat geofence diperbarui."
        : `Geofence tersimpan sebagai versi ${result.geofence.version}.`);
      setName("");
      setReason("");
      setPickCenter(false);
      if (canRead) await refreshGeofences(locationType, locationId);
    } catch (saveError: unknown) {
      if (saveError instanceof Error && saveError.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !user) {
    return <main className="session-state"><span className="session-spinner" /><p>Memuat akses geofence…</p></main>;
  }
  if (!user) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>{error || "Sesi tidak dapat diverifikasi."}</p><button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button></main>;
  }
  if (!canManage && !canRead) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>Peran Anda tidak memiliki izin membaca atau membuat geofence.</p><Link className="session-retry" href="/">Kembali ke dashboard</Link></main>;
  }
  if (!canReadMaster) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Izin master data diperlukan</h1><p>Untuk memilih lokasi geofence, akun memerlukan izin master:read sesuai scope-nya.</p><Link className="session-retry" href="/">Kembali ke dashboard</Link></main>;
  }

  return (
    <main className="app-shell">
      <AppSidebar />
      <section className="main-column" id="geofences">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><span>Operasional</span><ChevronRight size={14} /><strong>Geofence</strong></div>
          <div className="topbar-actions"><span className="environment"><span className="live-dot" />DATA OPERASIONAL</span><span className="date-button"><Clock3 size={15} />Hari ini</span></div>
        </header>
        <div className="content-area geofence-content-area">
          <div className="approval-heading geofence-heading">
            <div className="approval-heading-icon"><MapPinned size={19} /></div>
            <div><div className="eyebrow"><span className="eyebrow-line" />BATAS OPERASIONAL · WGS84</div><h1>Geofence</h1><p>Buat, edit, dan kelola batas lingkaran untuk validasi GPS SPPG atau lokasi penyaluran.</p></div>
            <div className="geofence-header-actions">
              <button className="geofence-reset-button" onClick={() => setReloadKey((value) => value + 1)} type="button"><RefreshCw size={14} /> Muat ulang</button>
              <button className="geofence-reset-button" onClick={() => window.alert("Panduan Geofence:\n1. Pilih jenis lokasi (SPPG/Penyaluran) dan bentuk (Lingkaran/Multi titik).\n2. Isi koordinat atau klik peta untuk menentukan pusat/titik.\n3. Atur radius, akurasi GPS, fix konfirmasi, dan durasi.\n4. Isi nama dan alasan perubahan.\n5. Simpan. Perubahan akan membuat versi baru dan mencatat audit.")} type="button">Panduan</button>
              <button className="approval-button approve" onClick={() => document.getElementById("geofence-form")?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button"><Plus size={15} /> Buat Geofence</button>
            </div>
          </div>

          {error && <div className="approval-error" role="alert">{error}</div>}
          {notice && <div className="approval-notice" role="status">{notice}</div>}

          <div className="geofence-workspace">
            <form className="panel geofence-form" id="geofence-form" onSubmit={submitGeofence}>
            <div className="geofence-panel-heading"><div><h2>{canManage ? "Buat geofence" : "Geofence lokasi"}</h2><p>Lingkaran beradius meter; pusat dapat dipilih di peta atau diisi dengan koordinat.</p></div><CircleDot size={18} /></div>
            <div className="geofence-form-section">
              <h3 className="geofence-form-section-title"><MapPinned size={14} /> Lokasi & Bentuk</h3>
              <p className="geofence-form-section-desc">Pilih jenis lokasi terikat dan bentuk batas. Perubahan bentuk akan membuat versi baru.</p>
              <div className="geofence-choice-row">
                <div className="geofence-choice-group">
                  <span className="geofence-choice-label">Jenis lokasi</span>
                  <div className="geofence-segmented" role="radiogroup" aria-label="Jenis lokasi" style={{ display: "flex", flexWrap: "nowrap", gap: "10px" }}>
                    <button className={`geofence-segment ${locationType === "SPPG" ? "selected" : ""}`} onClick={() => updateLocation("SPPG", sppgs.find((sppg) => sppg.status === "ACTIVE")?.id ?? "")} title="Lokasi dapur / distribusi" type="button" aria-pressed={locationType === "SPPG"}>
                      <span className="geofence-segment-icon"><Utensils size={15} /></span>
                      <span className="geofence-segment-copy"><strong>SPPG</strong></span>
                    </button>
                    <button className={`geofence-segment ${locationType === "DELIVERY" ? "selected" : ""}`} onClick={() => updateLocation("DELIVERY", deliveryLocations.find((location) => location.active)?.id ?? "")} title="Titik tujuan distribusi" type="button" aria-pressed={locationType === "DELIVERY"}>
                      <span className="geofence-segment-icon"><MapPinned size={15} /></span>
                      <span className="geofence-segment-copy"><strong>Lokasi penyaluran</strong></span>
                    </button>
                  </div>
                </div>

                {canManage && <div className="geofence-choice-group">
                  <span className="geofence-choice-label">Bentuk batas</span>
                  <div className="geofence-segmented" role="radiogroup" aria-label="Bentuk batas" style={{ display: "flex", flexWrap: "nowrap", gap: "10px" }}>
                    <button className={`geofence-segment ${shapeType === "CIRCLE" ? "selected" : ""}`} onClick={() => { setShapeType("CIRCLE"); setPolygonPoints([]); setDrawPolygon(false); }} title="Pusat + radius (meter)" type="button" aria-pressed={shapeType === "CIRCLE"}>
                      <span className="geofence-segment-icon"><CircleDot size={15} /></span>
                      <span className="geofence-segment-copy"><strong>Lingkaran</strong></span>
                    </button>
                    <button className={`geofence-segment ${shapeType === "POLYGON" ? "selected" : ""}`} onClick={() => { setShapeType("POLYGON"); setPolygonPoints([]); }} title="Poligon (minimal 3 titik)" type="button" aria-pressed={shapeType === "POLYGON"}>
                      <span className="geofence-segment-icon"><Crosshair size={15} /></span>
                      <span className="geofence-segment-copy"><strong>Multi titik</strong></span>
                    </button>
                  </div>
                </div>}
              </div>

              <label className="geofence-field"><span>Lokasi terikat</span><select disabled={!canManage || !locations.length} onChange={(event) => updateLocation(locationType, event.target.value)} value={locationId}><option value="">Pilih lokasi</option>{locations.map((location) => <option disabled={!location.active} key={location.id} value={location.id}>{location.code} · {location.name}{location.active ? "" : " · nonaktif"}</option>)}</select></label>
              {selectedLocation?.address && <p className="geofence-address">{selectedLocation.address}</p>}
            </div>

            {canManage && <>
              {shapeType === "POLYGON" && (
                <div className="geofence-polygon-tools">
                  <div className="geofence-coordinate-heading"><strong>Titik poligon</strong><button className={`geofence-pick-button ${drawPolygon ? "active" : ""}`} onClick={() => setDrawPolygon((value) => !value)} type="button" aria-pressed={drawPolygon}><Crosshair size={14} />{drawPolygon ? "Klik peta menambah titik" : "Gambar di peta"}</button></div>
                  <p className="geofence-address">{polygonPoints.length} titik · minimal 3 titik untuk menyimpan. Klik titik terakhir? Gunakan tombol hapus.</p>
                  {polygonPoints.length > 0 && <div className="geofence-polygon-list">{polygonPoints.map((point, index) => <span key={`${point.longitude}-${point.latitude}-${index}`}>{index + 1}: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</span>)}</div>}
                  <div className="geofence-polygon-actions">
                    <button className="geofence-pick-button" disabled={!polygonPoints.length} onClick={() => setPolygonPoints((points) => points.slice(0, -1))} type="button">Hapus titik terakhir</button>
                    <button className="geofence-pick-button" disabled={!polygonPoints.length} onClick={() => setPolygonPoints([])} type="button">Hapus semua</button>
                  </div>
                </div>
              )}

              <label className="geofence-field"><span>Nama batas</span><input autoComplete="off" maxLength={160} minLength={3} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Area validasi kedatangan" required value={name} /></label>
              {shapeType === "CIRCLE" && <>
                <div className="geofence-coordinate-heading"><strong>Pusat lingkaran</strong><button className={`geofence-pick-button ${pickCenter ? "active" : ""}`} onClick={() => setPickCenter((active) => !active)} type="button" aria-pressed={pickCenter}><Crosshair size={14} />{pickCenter ? "Klik peta untuk menetapkan" : "Pilih di peta"}</button></div>
                <div className="geofence-coordinate-grid">
                  <label className="geofence-field"><span>Latitude</span><input max={90} min={-90} onChange={(event) => setCenterLatitude(event.target.value)} placeholder="-6.2088" required step="0.000001" type="number" value={centerLatitude} /></label>
                  <label className="geofence-field"><span>Longitude</span><input max={180} min={-180} onChange={(event) => setCenterLongitude(event.target.value)} placeholder="106.8456" required step="0.000001" type="number" value={centerLongitude} /></label>
                </div>
                <label className="geofence-field"><span>Radius (meter)</span><div className="geofence-radius-input"><input max={10_000} min={10} onChange={(event) => setRadiusMeters(event.target.value)} placeholder="10–10.000 m" required step="0.01" type="number" value={radiusMeters} /><span>m</span></div></label>
              </>}

              <div className="geofence-policy-grid">
                <label className="geofence-field"><span>Akurasi GPS maksimum</span><div className="geofence-radius-input"><input max={500} min={1} onChange={(event) => setMinGpsAccuracyMeters(event.target.value)} required step="1" type="number" value={minGpsAccuracyMeters} /><span>m</span></div></label>
                <label className="geofence-field"><span>Fix konfirmasi</span><input max={10} min={2} onChange={(event) => setConfirmationFixes(event.target.value)} required step="1" type="number" value={confirmationFixes} /></label>
              </div>
              <label className="geofence-field"><span>Durasi konfirmasi minimum</span><div className="geofence-radius-input"><input max={120} min={0} onChange={(event) => setConfirmationDurationSeconds(event.target.value)} required step="1" type="number" value={confirmationDurationSeconds} /><span>detik</span></div></label>
              <label className="geofence-field"><span>Alasan perubahan (tercatat di audit)</span><textarea maxLength={2000} minLength={3} onChange={(event) => setReason(event.target.value)} placeholder="Jelaskan kebutuhan atau dasar pembuatan batas ini" required rows={3} value={reason} /></label>
              <div className="geofence-version-notice"><ShieldCheck size={15} /><span>Menyimpan batas baru akan menonaktifkan geofence aktif sebelumnya untuk lokasi ini dan membuat versi berikutnya. Riwayat lama tetap tersimpan.</span></div>
              <button className="approval-button approve geofence-submit" disabled={saving || !locationId || !canCreateForLocation || !hasValidDraft} type="submit"><Save size={15} />{saving ? "Menyimpan…" : "Simpan geofence"}</button>
            </>}
          </form>

          <section className="panel geofence-map-panel" aria-label="Peta dan preview geofence">
            <div className="geofence-panel-heading"><div><h2>Peta OpenStreetMap</h2><p>{pickCenter ? "Pilih titik pusat di peta." : "Lingkaran preview mengikuti koordinat dan radius pada formulir."}</p></div><span className={`geofence-map-mode ${pickCenter ? "active" : ""}`}>{pickCenter ? "PILIH PUSAT" : "WGS84"}</span></div>
            <div className="geofence-map-viewport">
              <FleetMap
                trips={[]}
                emptyMessage={pickCenter ? "Klik peta untuk menetapkan pusat geofence." : undefined}
                geofenceCircles={canRead ? geofences : []}
                draftGeofence={shapeType === "CIRCLE" ? draftGeofence : null}
                pickGeofenceCenter={pickCenter && canManage && shapeType === "CIRCLE"}
                onPickGeofenceCenter={(longitude, latitude) => {
                  setCenterLongitude(longitude.toFixed(6));
                  setCenterLatitude(latitude.toFixed(6));
                  setPickCenter(false);
                }}
                focusPoint={focusPoint}
                polygonPoints={shapeType === "POLYGON" ? polygonPoints : null}
                drawPolygonMode={drawPolygon && canManage && shapeType === "POLYGON"}
                onPolygonPointClick={(longitude, latitude) => {
                  setPolygonPoints((points) => [...points, { longitude, latitude }]);
                }}
              />
            </div>
            <div className="geofence-map-legend"><span><i className="geofence-legend-draft" />Preview baru</span><span><i className="geofence-legend-active" />Aktif</span><span><i className="geofence-legend-history" />Versi lama</span><small>{geofencesLoading ? "Memuat riwayat…" : `${geofences.length} versi tersimpan`}</small></div>
          </section>
        </div>

        <section className="panel geofence-history">
          <div className="geofence-history-heading"><div><h2>Riwayat untuk {selectedLocation?.name ?? "lokasi terpilih"}</h2><p>Versi lama dipertahankan untuk audit dan tidak dihapus.</p></div><span>{geofences.length} versi</span></div>
          {geofencesLoading ? <div className="approval-empty"><span className="session-spinner" /><span>Memuat riwayat geofence…</span></div> : geofences.length ? (
            <div className="geofence-history-list">{geofences.map((geofence) => <button className="geofence-history-item geofence-history-edit" key={geofence.id} onClick={() => {
              setShapeType(geofence.shapeType === "POLYGON" ? "POLYGON" : "CIRCLE");
              setName(geofence.name);
              if (geofence.shapeType === "POLYGON" && geofence.polygonCoordinates) {
                setPolygonPoints(geofence.polygonCoordinates.map((p) => ({ longitude: Number(p.longitude), latitude: Number(p.latitude) })));
                setCenterLatitude("");
                setCenterLongitude("");
                setRadiusMeters("");
              } else {
                setPolygonPoints([]);
                setCenterLatitude(String(geofence.centerLatitude ?? ""));
                setCenterLongitude(String(geofence.centerLongitude ?? ""));
                setRadiusMeters(String(geofence.radiusMeters ?? ""));
              }
              setMinGpsAccuracyMeters(String(geofence.minGpsAccuracyMeters));
              setConfirmationFixes(String(geofence.confirmationFixes));
              setConfirmationDurationSeconds(String(geofence.confirmationDurationSeconds));
              setNotice(`Memuat versi ${geofence.version} ke formulir. Menyimpan akan membuat versi baru.`);
            }} type="button">
              <span className={`geofence-history-icon ${geofence.active ? "active" : ""}`}><CircleDot size={16} /></span>
              <div className="geofence-history-copy"><strong>{geofence.name}</strong><span>Versi {geofence.version} · radius {Number(geofence.radiusMeters).toLocaleString("id-ID")} m · dibuat {formatDate(geofence.createdAt)}</span></div>
              <span className={`geofence-history-status ${geofence.active ? "active" : ""}`}>{geofence.active ? "Aktif" : "Riwayat"}</span>
            </button>)}</div>
          ) : <div className="approval-empty"><CircleDot size={20} /><strong>{canRead ? "Belum ada geofence untuk lokasi ini" : "Riwayat tidak tersedia"}</strong><span>{canRead ? "Buat batas baru menggunakan formulir dan peta." : "Akun Anda dapat membuat batas, tetapi tidak memiliki izin membaca riwayat."}</span></div>}
        </section>
      </div>
      </section>
    </main>
  );
}
