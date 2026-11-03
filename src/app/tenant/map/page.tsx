"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleDot, Crosshair, MapPinned, Plus, Save, Search, ShieldCheck, X } from "lucide-react";
import { FleetMap } from "@/components/fleet-map";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import {
  apiBaseUrl,
  getCurrentSession,
  hasPermission,
  type DeliveryLocationOption,
  type GeofenceLocationType,
  type GeofenceSummary,
  type SessionUser,
} from "@/lib/api";

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
  return "Gagal disimpan. Periksa data, koneksi, dan izin akun lalu coba lagi.";
}

type SearchResult = { display_name: string; lat: string; lon: string };

export default function TenantMapPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sppgId, setSppgId] = useState<string | null>(null);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocationOption[]>([]);
  const [locationType, setLocationType] = useState<GeofenceLocationType>("SPPG");
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
  const [searchRouteCoords, setSearchRouteCoords] = useState<Array<{ longitude: number; latitude: number }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [geofencesLoading, setGeofencesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shapeType, setShapeType] = useState<"CIRCLE" | "POLYGON">("CIRCLE");

  // Add Location state
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({ code: "", name: "", address: "", latitude: "", longitude: "" });
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pickLocation, setPickLocation] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMarker, setSearchMarker] = useState<{ longitude: number; latitude: number } | null>(null);

  const canManageLocation = user ? hasPermission(user, "master:manage") : false;

  const originMarker = useMemo(() => {
    if (!selectedLocationId) return null;
    const loc = deliveryLocations.find((l) => l.id === selectedLocationId);
    return loc?.latitude && loc?.longitude ? { longitude: Number(loc.longitude), latitude: Number(loc.latitude) } : null;
  }, [selectedLocationId, deliveryLocations]);

  const selectedDeliveryLocation = deliveryLocations.find((l) => l.id === selectedLocationId) ?? null;
  const focusPoint = originMarker ?? searchMarker;

  const loadGeofences = useCallback(async (type: GeofenceLocationType, id: string) => {
    if (!id) return;
    setGeofencesLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/geofences?locationType=${type}&locationId=${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat geofence");
      const data = await res.json();
      setGeofences(Array.isArray(data) ? data : []);
    } catch {
      setGeofences([]);
    } finally {
      setGeofencesLoading(false);
    }
  }, []);

  const loadDeliveryLocations = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/delivery-locations`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDeliveryLocations(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const u = await getCurrentSession();
        if (!active) return;
        setUser(u);
        const meRes = await fetch(`${apiBaseUrl}/tenant/me`, { credentials: "include" });
        if (meRes.ok) {
          const me = await meRes.json();
          if (me?.legacySppgId) {
            setSppgId(me.legacySppgId);
            setLocationId(me.legacySppgId);
          }
        }
        await loadDeliveryLocations();
        setLoading(false);
      } catch {
        if (!active) return;
        router.replace("/login?expired=1");
      }
    })();
    return () => { active = false; };
  }, [router, loadDeliveryLocations]);

  useEffect(() => {
    if (locationId) {
      void loadGeofences(locationType, locationId);
    }
  }, [locationType, locationId, loadGeofences]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`, {
          headers: { "Accept-Language": "id" },
        });
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSelect = (result: SearchResult) => {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    setSearchMarker({ longitude: lon, latitude: lat });
    setSearchResults([]);
    setSearchQuery(result.display_name);
  };

  const handleSelectLocation = (loc: DeliveryLocationOption) => {
    if (loc.latitude && loc.longitude) {
      setCenterLatitude(String(loc.latitude));
      setCenterLongitude(String(loc.longitude));
    }
    setSelectedLocationId(loc.id);
  };

  const handleAddLocation = async (e: FormEvent) => {
    e.preventDefault();
    setSavingLocation(true);
    setLocationError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`${apiBaseUrl}/tenant/delivery-locations`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          code: locationForm.code.trim().toUpperCase(),
          name: locationForm.name.trim(),
          address: locationForm.address.trim() || undefined,
          latitude: locationForm.latitude ? Number(locationForm.latitude) : undefined,
          longitude: locationForm.longitude ? Number(locationForm.longitude) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setLocationForm({ code: "", name: "", address: "", latitude: "", longitude: "" });
      setShowAddLocation(false);
      await loadDeliveryLocations();
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Gagal menyimpan lokasi");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSubmitGeofence = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) return;
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const { csrfToken } = await csrfRes.json();
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`${apiBaseUrl}/geofences`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          locationType,
          locationId,
          shapeType,
          name: name.trim() || `Geofence ${locationType}`,
          centerLatitude: centerLatitude ? Number(centerLatitude) : undefined,
          centerLongitude: centerLongitude ? Number(centerLongitude) : undefined,
          radiusMeters: radiusMeters ? Number(radiusMeters) : undefined,
          polygonCoordinates: polygonPoints.length >= 3 ? polygonPoints : undefined,
          minGpsAccuracyMeters: Number(minGpsAccuracyMeters) || 50,
          confirmationFixes: Number(confirmationFixes) || 2,
          confirmationDurationSeconds: Number(confirmationDurationSeconds) || 10,
          reason: reason.trim() || "Pembuatan geofence tenant",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.code || `REQUEST_FAILED_${res.status}`);
      }
      setName("");
      setCenterLatitude("");
      setCenterLongitude("");
      setRadiusMeters("");
      setPolygonPoints([]);
      setDrawPolygon(false);
      await loadGeofences(locationType, locationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan geofence");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="session-state"><span className="session-spinner" /><p>Memuat peta…</p></main>;
  }


  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Peta</strong></div>
          <div className="topbar-actions">
            <span className="environment"><span className="live-dot" />GEOFENCE & LOKASI</span>
            <span className="topbar-divider" />
            <HeaderAccount user={user} />
          </div>
        </header>
        <main className="content-area">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />PETA OPERASIONAL</div>
              <h1>Peta & Lokasi Tenant</h1>
              <p>Kelola lokasi penerima dan geofence untuk SPPG.</p>
            </div>
            <div className="page-heading-actions">
              {canManageLocation && (
                <button className="trip-create-trigger" onClick={() => {
                  const code = `DL-${Date.now().toString(36).toUpperCase()}`;
                  setLocationForm({ code, name: "", address: "", latitude: "", longitude: "" });
                  setShowAddLocation(true);
                }}>
                  <Plus size={14} />
                  Tambah lokasi
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="search-bar" style={{ marginBottom: "1rem", position: "relative" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari alamat atau tempat..."
                style={{ flex: 1, padding: "0.5rem", border: "1px solid #ccc", borderRadius: "6px" }}
              />
              {searching && <span className="session-spinner" style={{ width: "16px", height: "16px" }} />}
            </div>
            {searchResults.length > 0 && (
              <div className="search-results" style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ccc", borderRadius: "6px", zIndex: 10, maxHeight: "200px", overflow: "auto" }}>
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    className="search-result-item"
                    style={{ padding: "0.5rem", cursor: "pointer", borderBottom: "1px solid #eee" }}
                    onClick={() => handleSearchSelect(r)}
                  >
                    {r.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Tambah Lokasi (modal) */}
          {showAddLocation && (
            <div className="trip-modal-backdrop" onClick={() => !savingLocation && setShowAddLocation(false)}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="add-location-title">
                <button className="trip-modal-close" onClick={() => setShowAddLocation(false)} disabled={savingLocation} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <MapPinned size={18} />
                  </div>
                  <div>
                    <h2 id="add-location-title">Tambah lokasi penerima</h2>
                    <p>Isi data lokasi baru. Klik peta untuk set koordinat atau gunakan pencarian.</p>
                  </div>
                </div>
                <form onSubmit={handleAddLocation} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        Kode lokasi
                      </span>
                      <input type="text" value={locationForm.code} readOnly className="readonly-input" />
                      <small>Kode dibuat otomatis</small>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        Nama lokasi
                      </span>
                      <input type="text" value={locationForm.name} onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama lokasi penerima" required />
                    </div>
                    <div className="trip-form-field" style={{ gridColumn: "1 / -1" }}>
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        Alamat
                      </span>
                      <input type="text" value={locationForm.address} onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))} placeholder="Alamat lengkap" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="2" x2="12" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                        </svg>
                        Latitude
                      </span>
                      <input type="number" step="any" value={locationForm.latitude} onChange={(e) => setLocationForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="-6.2" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="2" x2="12" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                        </svg>
                        Longitude
                      </span>
                      <input type="number" step="any" value={locationForm.longitude} onChange={(e) => setLocationForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="106.8" />
                    </div>
                  </div>
                  {pickLocation && (
                    <div className="trip-inline-state" role="status">
                      <Crosshair size={14} />
                      <span>Klik peta untuk set koordinat...</span>
                    </div>
                  )}
                  {locationError && (
                    <div className="trip-modal-error" role="alert">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      <span>{locationError}</span>
                    </div>
                  )}
                  <div className="trip-action-buttons">
                    <button type="button" className="trip-action-button muted" onClick={() => setPickLocation(true)} disabled={savingLocation}>
                      <Crosshair size={12} />
                      Pilih dari peta
                    </button>
                    <button type="button" className="trip-action-button muted" onClick={() => setShowAddLocation(false)} disabled={savingLocation}>
                      Batal
                    </button>
                    <button type="submit" className="trip-action-button primary" disabled={savingLocation || !locationForm.code || !locationForm.name}>
                      {savingLocation ? "Menyimpan..." : "Simpan lokasi"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Map + Lokasi side by side */}
          <div className="dashboard-main-grid" style={{ marginBottom: "1rem" }}>
            <section className="map-section" aria-label="Peta lokasi" style={{ minHeight: "400px" }}>
              <div className="map-frame" style={{ height: "100%" }}>
                <div className="map-visual" style={{ height: "100%" }}>
                  <FleetMap
                    trips={[]}
                    selectedTripId={null}
                    onSelectTrip={() => {}}
                    expanded={false}
                    pickGeofenceCenter={pickLocation}
                    onPickGeofenceCenter={(lon, lat) => {
                      setLocationForm((f) => ({ ...f, longitude: String(lon), latitude: String(lat) }));
                      setPickLocation(false);
                    }}
                    polygonPoints={polygonPoints}
                    onPolygonPointClick={(lon, lat) => {
                      if (drawPolygon) {
                        setPolygonPoints((prev) => [...prev, { longitude: lon, latitude: lat }]);
                      }
                    }}
                    drawPolygonMode={drawPolygon}
                    routeCoordinates={searchRouteCoords}
                    focusPoint={focusPoint}
                    originMarker={originMarker}
                  />
                </div>
              </div>
            </section>

            <section className="panel" aria-label="Lokasi penerima" style={{ overflow: "auto", maxHeight: "400px" }}>
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Lokasi penerima</h2><span className="count-chip">{deliveryLocations.length}</span></div>
                  <p>Klik baris untuk melihat detail.</p>
                </div>
              </div>
              {deliveryLocations.length === 0 ? (
                <p className="table-empty">Belum ada lokasi penerima.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>KODE</th><th>NAMA</th><th>KOORDINAT</th><th></th></tr>
                    </thead>
                    <tbody>
                      {deliveryLocations.map((loc) => (
                        <tr
                          key={loc.id}
                          onClick={() => handleSelectLocation(loc)}
                          style={{ cursor: "pointer" }}
                          className={selectedLocationId === loc.id ? "row-selected" : ""}
                        >
                          <td>{loc.code}</td>
                          <td>{loc.name}</td>
                          <td>{loc.latitude && loc.longitude ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}` : "—"}</td>
                          <td>
                            <button
                              type="button"
                              className="row-detail-link"
                              onClick={(e) => { e.stopPropagation(); handleSelectLocation(loc); }}
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedDeliveryLocation && (
                <div className="map-selection-panel" style={{ marginTop: "0.5rem", padding: "0.75rem" }}>
                  <div className="map-selection-heading">
                    <div>
                      <span className="map-selection-eyebrow">DETAIL LOKASI TERPILIH</span>
                      <strong>{selectedDeliveryLocation.code} · {selectedDeliveryLocation.name}</strong>
                      <small>{selectedDeliveryLocation.address ?? "Alamat tidak tersedia"}</small>
                    </div>
                  </div>
                  <div className="map-selection-meta">
                    <span><strong>Koordinat WGS84</strong><small>{selectedDeliveryLocation.latitude && selectedDeliveryLocation.longitude ? `${Number(selectedDeliveryLocation.latitude).toFixed(5)}, ${Number(selectedDeliveryLocation.longitude).toFixed(5)}` : "Tidak tersedia"}</small></span>
                    <span><strong>Status</strong><small>{selectedDeliveryLocation.active ? "Aktif" : "Nonaktif"}</small></span>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="panel" aria-label="Form geofence" style={{ marginTop: "1rem" }}>
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Buat geofence</h2></div>
                <p>Isi data geofence baru untuk lokasi terpilih.</p>
              </div>
            </div>
            <form onSubmit={handleSubmitGeofence} className="trip-create-form">
              <div className="trip-form-grid">
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                      <path d="M2 17l10 5 10-5"></path>
                      <path d="M2 12l10 5 10-5"></path>
                    </svg>
                    Tipe lokasi
                  </span>
                  <select value={locationType} onChange={(e) => { setLocationType(e.target.value as GeofenceLocationType); setLocationId(sppgId ?? ""); }}>
                    <option value="SPPG">SPPG (Tenant)</option>
                    <option value="DELIVERY">Lokasi pengiriman</option>
                  </select>
                </div>
                {locationType === "DELIVERY" && (
                  <div className="trip-form-field">
                    <span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      Lokasi pengiriman
                    </span>
                    <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                      <option value="">Pilih lokasi</option>
                      {deliveryLocations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                    </svg>
                    Bentuk
                  </span>
                  <select value={shapeType} onChange={(e) => setShapeType(e.target.value as "CIRCLE" | "POLYGON")}>
                    <option value="CIRCLE">Lingkaran</option>
                    <option value="POLYGON">Poligon</option>
                  </select>
                </div>
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    Nama geofence
                  </span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama geofence" />
                </div>
                {shapeType === "CIRCLE" && (
                  <>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="2" x2="12" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                        </svg>
                        Latitude center
                      </span>
                      <input type="number" step="any" value={centerLatitude} onChange={(e) => setCenterLatitude(e.target.value)} placeholder="-6.2" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="2" x2="12" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                        </svg>
                        Longitude center
                      </span>
                      <input type="number" step="any" value={centerLongitude} onChange={(e) => setCenterLongitude(e.target.value)} placeholder="106.8" />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                        Radius (meter)
                      </span>
                      <input type="number" value={radiusMeters} onChange={(e) => setRadiusMeters(e.target.value)} placeholder="500" min="1" />
                    </div>
                  </>
                )}
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    Min akurasi GPS (m)
                  </span>
                  <input type="number" value={minGpsAccuracyMeters} onChange={(e) => setMinGpsAccuracyMeters(e.target.value)} min="1" />
                </div>
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Konfirmasi fix
                  </span>
                  <input type="number" value={confirmationFixes} onChange={(e) => setConfirmationFixes(e.target.value)} min="1" />
                </div>
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Durasi konfirmasi (detik)
                  </span>
                  <input type="number" value={confirmationDurationSeconds} onChange={(e) => setConfirmationDurationSeconds(e.target.value)} min="0" />
                </div>
                <div className="trip-form-field">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    Alasan
                  </span>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan pembuatan" />
                </div>
              </div>
              {error && (
                <div className="trip-modal-error" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              <div className="trip-action-buttons">
                <button type="submit" className="trip-action-button primary" disabled={saving || !locationId || (shapeType === "CIRCLE" && (!centerLatitude || !centerLongitude || !radiusMeters))}>
                  {saving ? "Menyimpan..." : "Simpan geofence"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel" aria-label="Daftar geofence" style={{ marginTop: "1rem" }}>
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Geofence terdaftar</h2><span className="count-chip">{geofences.length}</span></div>
                <p>Geofence untuk lokasi terpilih.</p>
              </div>
            </div>
            {geofencesLoading ? (
              <p className="table-empty">Memuat geofence…</p>
            ) : geofences.length === 0 ? (
              <p className="table-empty">Belum ada geofence untuk lokasi ini.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>NAMA</th><th>BENTUK</th><th>RADIUS</th><th>AKTIF</th><th>DIBUAT</th></tr>
                  </thead>
                  <tbody>
                    {geofences.map((g) => (
                      <tr key={g.id}>
                        <td>{g.name}</td>
                        <td>{g.shapeType}</td>
                        <td>{g.radiusMeters ? `${g.radiusMeters} m` : "—"}</td>
                        <td>{g.active ? "Ya" : "Tidak"}</td>
                        <td>{new Date(g.createdAt).toLocaleDateString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data peta tenant</span>
            <span>Zona waktu Asia/Jakarta</span>
          </footer>
        </main>
      </section>
    </div>
  );
}