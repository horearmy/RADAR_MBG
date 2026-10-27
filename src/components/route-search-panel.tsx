"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Crosshair } from "lucide-react";

type Point = { latitude: number; longitude: number; name: string };

export function RouteSearchPanel({
  onRouteChange,
  onOriginChange,
  onDestinationChange,
  defaultSppgId,
  defaultDeliveryLocationId,
  drawMode,
  onDrawModeChange,
  drawPoints,
  onDrawPoint,
  onClearDraw,
  pickMode,
  onPickModeChange,
}: {
  onRouteChange: (coords: Array<{ latitude: number; longitude: number }> | null, info: { durationSeconds: number; distanceMeters: number } | null) => void;
  onOriginChange?: (p: Point | null) => void;
  onDestinationChange?: (p: Point | null) => void;
  defaultSppgId?: string;
  defaultDeliveryLocationId?: string;
  drawMode: boolean;
  onDrawModeChange: (v: boolean) => void;
  drawPoints: Array<{ latitude: number; longitude: number }>;
  onDrawPoint: (lng: number, lat: number) => void;
  onClearDraw: () => void;
  pickMode: "origin" | "destination" | null;
  onPickModeChange: (m: "origin" | "destination" | null) => void;
}) {
  const [origin, setOrigin] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [routing, setRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ durationSeconds: number; distanceMeters: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [routeName, setRouteName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sppgs, setSppgs] = useState<Array<{ id: string; code: string; name: string; status: string }>>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<Array<{ id: string; code: string; name: string; active: boolean }>>([]);
  const [originResults, setOriginResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [destResults, setDestResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);

  async function searchNominatim(q: string, setResults: (r: Array<{ display_name: string; lat: string; lon: string }>) => void) {
    if (q.trim().length < 3) { setResults([]); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`, { headers: { "Accept-Language": "id" } });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    }
  }

  async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { headers: { "Accept-Language": "id" } });
      const data = await res.json();
      return data?.display_name?.split(",")[0] ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => { void searchNominatim(originQuery, setOriginResults); }, 400);
    return () => window.clearTimeout(t);
  }, [originQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => { void searchNominatim(destQuery, setDestResults); }, 400);
    return () => window.clearTimeout(t);
  }, [destQuery]);

  async function computeRoute(o: Point, d: Point) {
    setRouting(true);
    setError("");
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${o.longitude},${o.latitude};${d.longitude},${d.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("NO_ROUTE");
      const r = data.routes[0];
      const coords = (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      const info = { durationSeconds: Math.round(r.duration), distanceMeters: Math.round(r.distance) };
      setRouteCoords(coords);
      setRouteInfo(info);
      onRouteChange(coords, info);
      setRouteName(`${o.name} → ${d.name}`);
    } catch {
      const coords = [o, d].map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
      setRouteCoords(coords);
      setRouteInfo(null);
      onRouteChange(coords, null);
      setError("Routing gagal. Ditampilkan garis langsung (estimasi).");
    } finally {
      setRouting(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (origin && destination) void computeRoute(origin, destination);
      else { setRouteCoords(null); setRouteInfo(null); onRouteChange(null, null); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [origin, destination]);

  async function saveRoute(e: FormEvent) {
    e.preventDefault();
    if (!origin || !destination || !routeCoords || routeCoords.length < 2) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { createRoute } = await import("@/lib/api");
      const sppgId = defaultSppgId || sppgs[0]?.id || "";
      const deliveryLocationId = defaultDeliveryLocationId || deliveryLocations[0]?.id || "";
      if (!sppgId || !deliveryLocationId) { setError("Pilih SPPG dan lokasi penyaluran terlebih dahulu."); setSaving(false); return; }
      const downsampled = routeCoords.length > 300
        ? routeCoords.filter((_, i) => i % Math.ceil(routeCoords.length / 300) === 0 || i === routeCoords.length - 1)
        : routeCoords;
      const result = await createRoute({
        name: routeName.trim() || `${origin.name} → ${destination.name}`,
        sppgId,
        deliveryLocationId,
        coordinates: downsampled,
        reason: "Pembuatan rute operasional",
      });
      setNotice(result.replayed ? "Rute sebelumnya sudah tersimpan." : `Rute tersimpan sebagai versi ${result.route.version}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rute gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  function selectOrigin(r: { display_name: string; lat: string; lon: string }) {
    const p = { latitude: Number(r.lat), longitude: Number(r.lon), name: r.display_name.split(",")[0] };
    setOrigin(p); setOriginQuery(p.name); setOriginResults([]);
    onOriginChange?.(p);
  }

  function selectDest(r: { display_name: string; lat: string; lon: string }) {
    const p = { latitude: Number(r.lat), longitude: Number(r.lon), name: r.display_name.split(",")[0] };
    setDestination(p); setDestQuery(p.name); setDestResults([]);
    onDestinationChange?.(p);
  }

  function swapPoints() {
    const o = origin; const d = destination;
    setOrigin(d); setDestination(o);
    setOriginQuery(d?.name ?? ""); setDestQuery(o?.name ?? "");
    onOriginChange?.(d); onDestinationChange?.(o);
  }

  // Expose pick handler to parent map clicks
  useEffect(() => {
    (window as unknown as { __routePickHandler?: (lng: number, lat: number) => void }).__routePickHandler = async (lng: number, lat: number) => {
      const name = await reverseGeocode(lat, lng);
      const p = { latitude: lat, longitude: lng, name };
      if (pickMode === "origin") {
        setOrigin(p); setOriginQuery(name); onOriginChange?.(p);
      } else if (pickMode === "destination") {
        setDestination(p); setDestQuery(name); onDestinationChange?.(p);
      }
      onPickModeChange(null);
    };
    return () => { delete (window as unknown as { __routePickHandler?: (lng: number, lat: number) => void }).__routePickHandler; };
  }, [pickMode]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const [{ getSppgOptions }, { getDeliveryLocationOptions }] = await Promise.all([
            import("@/lib/api").then((m) => ({ getSppgOptions: m.getSppgOptions })),
            import("@/lib/api").then((m) => ({ getDeliveryLocationOptions: m.getDeliveryLocationOptions })),
          ]);
          const [s, d] = await Promise.all([getSppgOptions(), getDeliveryLocationOptions()]);
          setSppgs(s);
          setDeliveryLocations(d);
        } catch { /* ignore */ }
      })();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const hasRoute = !!routeCoords && routeCoords.length >= 2;
  const isUnsaved = hasRoute && !notice;

  return (
    <div className="route-search-panel" style={{ position: "static", transform: "none", width: "100%", maxWidth: "none" }}>
      <div className="route-search-row">
        <span className="route-search-dot origin" />
        <input
          type="search"
          value={originQuery}
          onChange={(e) => setOriginQuery(e.target.value)}
          placeholder="Titik awal (alamat atau klik peta)…"
          aria-label="Titik awal"
        />
        {originResults.length > 0 && (
          <ul className="route-search-results">
            {originResults.map((r, i) => (
              <li key={i}><button type="button" onMouseDown={(e) => { e.preventDefault(); selectOrigin(r); }} onClick={(e) => { e.preventDefault(); selectOrigin(r); }}>{r.display_name}</button></li>
            ))}
          </ul>
        )}
      </div>
      <div className="route-search-middle">
        <button type="button" className="route-search-swap" onClick={swapPoints} aria-label="Tukar titik awal dan tujuan" title="Tukar">↕</button>
        <div className="route-search-pick-tools">
          <button type="button" className={`route-search-pick ${pickMode === "origin" ? "active" : ""}`} onClick={() => onPickModeChange(pickMode === "origin" ? null : "origin")} aria-pressed={pickMode === "origin"}>
            <Crosshair size={12} /> Awal
          </button>
          <button type="button" className={`route-search-pick ${pickMode === "destination" ? "active" : ""}`} onClick={() => onPickModeChange(pickMode === "destination" ? null : "destination")} aria-pressed={pickMode === "destination"}>
            <Crosshair size={12} /> Tujuan
          </button>
        </div>
      </div>
      <div className="route-search-row">
        <span className="route-search-dot dest" />
        <input
          type="search"
          value={destQuery}
          onChange={(e) => setDestQuery(e.target.value)}
          placeholder="Titik tujuan (alamat atau klik peta)…"
          aria-label="Titik tujuan"
        />
        {destResults.length > 0 && (
          <ul className="route-search-results">
            {destResults.map((r, i) => (
              <li key={i}><button type="button" onMouseDown={(e) => { e.preventDefault(); selectDest(r); }} onClick={(e) => { e.preventDefault(); selectDest(r); }}>{r.display_name}</button></li>
            ))}
          </ul>
        )}
      </div>
      {routing && <div className="route-search-info"><span className="route-search-spinner" /> Menghitung rute tercepat…</div>}
      {routeInfo && !routing && (
        <div className="route-search-info">
          <strong>{Math.round(routeInfo.durationSeconds / 60)} min</strong>
          <span>· {(routeInfo.distanceMeters / 1000).toFixed(1)} km</span>
          <span>· Rute tercepat</span>
        </div>
      )}
      {error && <div className="route-search-error">{error}</div>}
      {notice && <div className="route-search-notice">{notice}</div>}
      {isUnsaved && !notice && <div className="route-search-unsaved">Perubahan belum disimpan</div>}
      {hasRoute && (
        <form className="route-search-save" onSubmit={saveRoute}>
          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Nama rute (opsional)"
            aria-label="Nama rute"
          />
          <button type="submit" disabled={saving} className="approval-button approve">
            {saving ? "Menyimpan…" : "Simpan rute"}
          </button>
        </form>
      )}
    </div>
  );
}