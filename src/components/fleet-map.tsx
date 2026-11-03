"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  GeoJSONSource,
  StyleSpecification,
} from "maplibre-gl";
import type { TripSummary } from "@/lib/api";

export type GeofenceOverlay = {
  id: string;
  name: string;
  shapeType?: "CIRCLE" | "POLYGON";
  centerLatitude?: number | string | null;
  centerLongitude?: number | string | null;
  radiusMeters?: number | string | null;
  polygonCoordinates?: Array<{ latitude: number; longitude: number }> | null;
  active: boolean;
};

export type GeofenceCircleDraft = {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
};

const JAKARTA_CENTER: [number, number] = [106.8456, -6.2088];

const openStreetMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function circleCoordinates(longitude: number, latitude: number, radiusMeters: number) {
  const earthRadiusMeters = 6_371_008.8;
  const angularDistance = radiusMeters / earthRadiusMeters;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeRadians = longitude * Math.PI / 180;
  const points = Array.from({ length: 65 }, (_, index) => {
    const bearing = index / 64 * Math.PI * 2;
    const pointLatitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude = longitudeRadians + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(pointLatitude),
    );
    return [pointLongitude * 180 / Math.PI, pointLatitude * 180 / Math.PI];
  });
  return points;
}

function markerClass(trip: TripSummary, selected: boolean) {
  const statusClass = trip.status === "CANCELLED" || trip.status === "EXCEPTION"
    ? "fleet-marker-danger"
    : trip.verificationStatus === "VERIFIED" || trip.verificationStatus === "OVERRIDDEN"
      ? "fleet-marker-success"
      : trip.status === "ARRIVAL_DETECTED" || trip.status === "DELIVERY_IN_PROGRESS"
        ? "fleet-marker-violet"
        : trip.status === "IN_TRANSIT" || trip.status === "ARRIVAL_VERIFIED"
          ? "fleet-marker-primary"
          : "fleet-marker-warning";
  const freshnessClass = trip.trackingStatus === "STALE" || trip.trackingStatus === "OFFLINE"
    ? "fleet-marker-stale"
    : trip.trackingStatus === "GPS_UNAVAILABLE"
      ? "fleet-marker-unavailable"
      : "";
  return ["fleet-marker", statusClass, freshnessClass, selected ? "fleet-marker-selected" : ""]
    .filter(Boolean)
    .join(" ");
}

function popupContent(trip: TripSummary, position: TripSummary["positions"][number]) {
  const node = document.createElement("div");
  node.className = "fleet-popup";
  const heading = document.createElement("strong");
  heading.className = "fleet-popup-title";
  heading.textContent = `${trip.vehicle.plateNumber} · ${trip.driver.name}`;
  const route = document.createElement("span");
  route.className = "fleet-popup-route";
  route.textContent = `${trip.sppg.name} → ${trip.deliveryLocation.name}`;
  const status = document.createElement("span");
  status.className = "fleet-popup-status";
  status.textContent = `${trip.status.replaceAll("_", " ")} · GPS ${trip.trackingStatus.toLowerCase()}`;
  const meta = document.createElement("span");
  meta.className = "fleet-popup-meta";
  const received = new Date(position.serverReceivedAt);
  meta.textContent = `GPS ${received.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB · akurasi ${Number(position.accuracyMeters ?? 0).toFixed(0)} m`;
  node.append(heading, route, status, meta);
  return node;
}

export function FleetMap({
  trips,
  selectedTripId,
  onSelectTrip,
  expanded = false,
  emptyMessage,
  geofenceCircles = [],
  draftGeofence = null,
  pickGeofenceCenter = false,
  onPickGeofenceCenter,
  focusPoint,
  polygonPoints = null,
  onPolygonPointClick,
  drawPolygonMode = false,
  routeCoordinates = null,
  drawRouteMode = false,
  onRoutePointClick,
  pickRoutePoint = false,
  onRoutePointPick,
  originMarker = null,
  destinationMarker = null,
  routes = [],
  selectedRouteId = null,
  onSelectRoute,
}: {
  trips: TripSummary[];
  selectedTripId?: string | null;
  onSelectTrip?: (trip: TripSummary) => void;
  expanded?: boolean;
  emptyMessage?: string;
  geofenceCircles?: GeofenceOverlay[];
  draftGeofence?: GeofenceCircleDraft | null;
  pickGeofenceCenter?: boolean;
  onPickGeofenceCenter?: (longitude: number, latitude: number) => void;
  focusPoint?: { longitude: number; latitude: number } | null;
  polygonPoints?: Array<{ longitude: number; latitude: number }> | null;
  onPolygonPointClick?: (longitude: number, latitude: number) => void;
  drawPolygonMode?: boolean;
  draftPolygon?: Array<{ longitude: number; latitude: number }> | null;
  routeCoordinates?: Array<{ longitude: number; latitude: number }> | null;
  drawRouteMode?: boolean;
  onRoutePointClick?: (longitude: number, latitude: number) => void;
  pickRoutePoint?: boolean;
  onRoutePointPick?: (longitude: number, latitude: number) => void;
  originMarker?: { longitude: number; latitude: number } | null;
  destinationMarker?: { longitude: number; latitude: number } | null;
  routes?: Array<{ id: string; name: string; coordinates: Array<{ latitude: number; longitude: number }>; active: boolean }>;
  selectedRouteId?: string | null;
  onSelectRoute?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const fittedSignatureRef = useRef("");
  const onSelectTripRef = useRef(onSelectTrip);
  const onPickGeofenceCenterRef = useRef(onPickGeofenceCenter);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [showTrips, setShowTrips] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);

  const positioned = trips.filter((trip) => trip.positions.length > 0);

  async function runSearch() {
    const q = searchQuery.trim();
    if (q.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`, {
        headers: { "Accept-Language": "id" },
      });
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function flyToResult(result: { lat: string; lon: string }) {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 14, duration: 800 });
    setSearchResults([]);
    setSearchQuery("");
  }

  useEffect(() => {
    onSelectTripRef.current = onSelectTrip;
  }, [onSelectTrip]);

  useEffect(() => {
    onPickGeofenceCenterRef.current = onPickGeofenceCenter;
  }, [onPickGeofenceCenter]);

  const onPolygonPointClickRef = useRef(onPolygonPointClick);
  useEffect(() => {
    onPolygonPointClickRef.current = onPolygonPointClick;
  }, [onPolygonPointClick]);
  const onRoutePointPickRef = useRef(onRoutePointPick);
  useEffect(() => {
    onRoutePointPickRef.current = onRoutePointPick;
  }, [onRoutePointPick]);
  useEffect(() => {
    if (!ready || !mapRef.current || !pickRoutePoint) return;
    const map = mapRef.current;
    const canvasContainer = map.getCanvasContainer();
    const handlePick = (event: { lngLat: { lng: number; lat: number } }) => {
      onRoutePointPickRef.current?.(event.lngLat.lng, event.lngLat.lat);
    };
    canvasContainer.style.cursor = "crosshair";
    map.on("click", handlePick);
    return () => {
      map.off("click", handlePick);
      canvasContainer.style.cursor = "";
    };
  }, [pickRoutePoint, ready]);
  const onRoutePointClickRef = useRef(onRoutePointClick);
  useEffect(() => {
    onRoutePointClickRef.current = onRoutePointClick;
  }, [onRoutePointClick]);
  useEffect(() => {
    if (!ready || !mapRef.current || !drawRouteMode) return;
    const map = mapRef.current;
    const canvasContainer = map.getCanvasContainer();
    const handlePick = (event: { lngLat: { lng: number; lat: number } }) => {
      onRoutePointClickRef.current?.(event.lngLat.lng, event.lngLat.lat);
    };
    canvasContainer.style.cursor = "crosshair";
    map.on("click", handlePick);
    return () => {
      map.off("click", handlePick);
      canvasContainer.style.cursor = "";
    };
  }, [drawRouteMode, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !drawPolygonMode) return;
    const map = mapRef.current;
    const canvasContainer = map.getCanvasContainer();
    const handlePick = (event: { lngLat: { lng: number; lat: number } }) => {
      onPolygonPointClickRef.current?.(event.lngLat.lng, event.lngLat.lat);
    };
    canvasContainer.style.cursor = "crosshair";
    map.on("click", handlePick);
    return () => {
      map.off("click", handlePick);
      canvasContainer.style.cursor = "";
    };
  }, [drawPolygonMode, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const existing = (map as unknown as { __odMarkers?: unknown[] }).__odMarkers || [];
    existing.forEach((m: unknown) => { try { (m as { remove: () => void }).remove(); } catch {} });
    (map as unknown as { __odMarkers?: unknown[] }).__odMarkers = [];
    const markers: unknown[] = [];
    void import("maplibre-gl").then((ml) => {
      if (originMarker) {
        const el = document.createElement("div");
        el.style.background = "#1677ff";
        el.style.border = "3px solid #fff";
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.boxShadow = "0 0 0 4px rgba(22,119,255,0.3), 0 2px 6px rgba(0,0,0,0.3)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.color = "#fff";
        el.style.fontSize = "11px";
        el.style.fontWeight = "700";
        el.textContent = "A";
        const marker = new ml.Marker({ element: el, anchor: "center" }).setLngLat([originMarker.longitude, originMarker.latitude]).addTo(map);
        markers.push(marker);
      }
      if (destinationMarker) {
        const el = document.createElement("div");
        el.style.background = "#ef4444";
        el.style.border = "3px solid #fff";
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.boxShadow = "0 0 0 4px rgba(239,68,68,0.3), 0 2px 6px rgba(0,0,0,0.3)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.color = "#fff";
        el.style.fontSize = "11px";
        el.style.fontWeight = "700";
        el.textContent = "B";
        const marker = new ml.Marker({ element: el, anchor: "center" }).setLngLat([destinationMarker.longitude, destinationMarker.latitude]).addTo(map);
        markers.push(marker);
      }
      (map as unknown as { __odMarkers?: unknown[] }).__odMarkers = markers;
    });
  }, [originMarker, destinationMarker, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const features = routes.map((r) => ({
      type: "Feature" as const,
      properties: { id: r.id, name: r.name, active: r.active, selected: r.id === selectedRouteId },
      geometry: { type: "LineString" as const, coordinates: r.coordinates.map((c) => [Number(c.longitude), Number(c.latitude)]) },
    }));
    const source = map.getSource("saved-routes") as GeoJSONSource | undefined;
    if (!source) {
      map.addSource("saved-routes", { type: "geojson", data: { type: "FeatureCollection", features } });
      map.addLayer({
        id: "saved-routes-line",
        type: "line",
        source: "saved-routes",
        paint: {
          "line-color": ["case", ["==", ["get", "selected"], true], "#f59e0b", ["==", ["get", "active"], true], "#1677ff", "#94a3b8"],
          "line-width": ["case", ["==", ["get", "selected"], true], 5, 3],
          "line-opacity": 0.85,
        },
      });
      map.on("click", "saved-routes-line", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRoute?.(String(id));
      });
      map.on("mouseenter", "saved-routes-line", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "saved-routes-line", () => { map.getCanvas().style.cursor = ""; });
    } else {
      source.setData({ type: "FeatureCollection", features });
    }
    if (features.length > 0) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const r of routes) {
        for (const c of r.coordinates) {
          const lng = Number(c.longitude); const lat = Number(c.latitude);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
          minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
        }
      }
      if (Number.isFinite(minLng)) {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, maxZoom: 13, duration: 0 });
      }
    }
  }, [routes, selectedRouteId, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const coords = routeCoordinates && routeCoordinates.length >= 2
      ? routeCoordinates.map((p) => [p.longitude, p.latitude])
      : [];
    const source = map.getSource("operational-routes") as GeoJSONSource | undefined;
    if (!source) {
      map.addSource("operational-routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: coords.length ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] },
      });
      map.addLayer({
        id: "operational-routes-line",
        type: "line",
        source: "operational-routes",
        paint: { "line-color": "#1677ff", "line-width": 4, "line-opacity": 0.85 },
      });
    } else {
      source.setData({ type: "FeatureCollection", features: coords.length ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });
    }
  }, [ready, routeCoordinates]);

  useEffect(() => {
    if (!expanded || !mapRef.current) return;
    const frame = window.requestAnimationFrame(() => mapRef.current?.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    if (!ready || !mapRef.current || !pickGeofenceCenter) return;
    const map = mapRef.current;
    const canvasContainer = map.getCanvasContainer();
    const handlePick = (event: { lngLat: { lng: number; lat: number } }) => {
      onPickGeofenceCenterRef.current?.(event.lngLat.lng, event.lngLat.lat);
    };
    canvasContainer.style.cursor = "crosshair";
    map.on("click", handlePick);
    return () => {
      map.off("click", handlePick);
      canvasContainer.style.cursor = "";
    };
  }, [pickGeofenceCenter, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !focusPoint) return;
    mapRef.current.flyTo({
      center: [focusPoint.longitude, focusPoint.latitude],
      zoom: 14,
      duration: 650,
    });
  }, [focusPoint, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
      const features: GeoJSON.Feature[] = [];
      if (!showGeofences) {
        const source = map.getSource("operational-geofences") as GeoJSONSource | undefined;
        if (source) source.setData({ type: "FeatureCollection", features: [] });
        return;
      }
    for (const geofence of geofenceCircles) {
      const shapeType = geofence.shapeType ?? "CIRCLE";
      if (shapeType === "POLYGON" && geofence.polygonCoordinates && geofence.polygonCoordinates.length >= 3) {
        const coords = geofence.polygonCoordinates.map((p) => [Number(p.longitude), Number(p.latitude)]);
        const properties = { id: geofence.id, name: geofence.name, active: geofence.active, kind: "saved" };
        features.push({
          type: "Feature",
          properties,
          geometry: { type: "Polygon", coordinates: [coords] },
        });
        continue;
      }
      const longitude = Number(geofence.centerLongitude);
      const latitude = Number(geofence.centerLatitude);
      const radiusMeters = Number(geofence.radiusMeters);
      if (![longitude, latitude, radiusMeters].every(Number.isFinite) || radiusMeters <= 0) continue;
      const properties = { id: geofence.id, name: geofence.name, active: geofence.active, kind: "saved" };
      features.push({
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: [circleCoordinates(longitude, latitude, radiusMeters)] },
      });
      features.push({
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [longitude, latitude] },
      });
    }
    if (draftGeofence && [draftGeofence.centerLongitude, draftGeofence.centerLatitude, draftGeofence.radiusMeters].every(Number.isFinite) && draftGeofence.radiusMeters > 0) {
      const properties = { id: "draft", name: "Preview", active: true, kind: "draft" };
      features.push({
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: [circleCoordinates(draftGeofence.centerLongitude, draftGeofence.centerLatitude, draftGeofence.radiusMeters)] },
      });
      features.push({
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [draftGeofence.centerLongitude, draftGeofence.centerLatitude] },
      });
    }
    if (polygonPoints && polygonPoints.length >= 3) {
      const coords = polygonPoints.map((p) => [p.longitude, p.latitude]);
      const properties = { id: "draft-polygon", name: "Preview", active: true, kind: "draft" };
      features.push({
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: [coords] },
      });
    }
    if (polygonPoints) {
      for (const point of polygonPoints) {
        features.push({
          type: "Feature",
          properties: { id: "draft-point", name: "Preview", active: true, kind: "draft" },
          geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        });
      }
    }

    let source = map.getSource("operational-geofences") as GeoJSONSource | undefined;
    if (!source) {
      map.addSource("operational-geofences", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      source = map.getSource("operational-geofences") as GeoJSONSource;
      const tokens = getComputedStyle(document.documentElement);
      const primary = tokens.getPropertyValue("--color-primary").trim() || "#1677ff";
      const warning = tokens.getPropertyValue("--color-warning").trim() || "#f59e0b";
      const muted = tokens.getPropertyValue("--color-content-muted").trim() || "#92a0b1";
      const color = ["case", ["==", ["get", "kind"], "draft"], warning, ["==", ["get", "active"], true], primary, muted] as unknown as string;
      map.addLayer({
        id: "operational-geofences-fill",
        type: "fill",
        source: "operational-geofences",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": color,
          "fill-opacity": 0.12,
        },
      } as Parameters<MapLibreMap["addLayer"]>[0]);
      map.addLayer({
        id: "operational-geofences-line",
        type: "line",
        source: "operational-geofences",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": color,
          "line-width": 2,
          "line-dasharray": [2, 1.5],
        },
      } as Parameters<MapLibreMap["addLayer"]>[0]);
      map.addLayer({
        id: "operational-geofences-center",
        type: "circle",
        source: "operational-geofences",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": color,
          "circle-radius": 5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      } as Parameters<MapLibreMap["addLayer"]>[0]);
    } else {
      source.setData({ type: "FeatureCollection", features });
    }
  }, [draftGeofence, geofenceCircles, polygonPoints, ready, showGeofences]);

  useEffect(() => {
    let cancelled = false;
    let loadTimeout: number | undefined;

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled || !containerRef.current) return;
        maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: openStreetMapStyle,
          center: JAKARTA_CENTER,
          zoom: 10.5,
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }));
        mapRef.current = map;
        let styleLoaded = false;
        map.once("style.load", () => {
          if (cancelled) return;
          styleLoaded = true;
          window.clearTimeout(loadTimeout);
          setError(false);
          setReady(true);
          map.resize();
        });
        map.on("error", () => {
          if (!cancelled) setError(true);
        });
        // Handle WebGL context lost
        const canvas = map.getCanvas();
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          console.warn("WebGL context lost, attempting to restore...");
          setTimeout(() => {
            if (!cancelled) {
              map.resize();
            }
          }, 100);
        });
        canvas.addEventListener("webglcontextrestored", () => {
          console.log("WebGL context restored");
          if (!cancelled) {
            map.resize();
          }
        });
        loadTimeout = window.setTimeout(() => {
          if (cancelled || styleLoaded) return;
          setError(true);
        }, 15000);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      fittedSignatureRef.current = "";
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let active = true;

    void import("maplibre-gl").then((maplibregl) => {
      if (!active || !mapRef.current) return;
      const map = mapRef.current;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const bounds = new maplibregl.LngLatBounds();

      for (const trip of trips) {
        if (!showTrips) continue;
        const position = trip.positions[0];
        if (!position) continue;
        const latitude = Number(position.latitude);
        const longitude = Number(position.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        const element = document.createElement("button");
        element.type = "button";
        const selected = trip.id === selectedTripId;
        element.className = markerClass(trip, selected);
        element.title = `${trip.vehicle.plateNumber} · ${trip.driver.name} · ${trip.status} · GPS ${trip.trackingStatus}`;
        element.setAttribute(
          "aria-label",
          `${trip.vehicle.plateNumber}, ${trip.driver.name}, ${trip.status}`,
        );

        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setDOMContent(
          popupContent(trip, position),
        );
        element.addEventListener("click", () => {
          onSelectTripRef.current?.(trip);
          popup.setLngLat([longitude, latitude]).addTo(map);
        });

        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([longitude, latitude])
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([longitude, latitude]);
      }

      const signature = trips.map(({ id }) => id).join("|");
      if (signature !== fittedSignatureRef.current && markersRef.current.length) {
        map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 0 });
        fittedSignatureRef.current = signature;
      }
    });

    return () => { active = false; };
  }, [trips, ready, selectedTripId, showTrips]);

  return (
    <div className="fleet-map">
      <div ref={containerRef} className="fleet-map-canvas" />
      <div className="fleet-map-search" role="search">
        <div>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void runSearch(); } }}
            placeholder="Cari tempat (OpenStreetMap)…"
            aria-label="Cari tempat di peta"
          />
          <button type="button" onClick={() => void runSearch()} disabled={searching} aria-label="Cari">
            {searching ? "…" : "Cari"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="fleet-map-search-results">
            {searchResults.map((result, index) => (
              <li key={`${result.lat}-${result.lon}-${index}`}>
                <button type="button" onClick={() => flyToResult(result)}>{result.display_name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="fleet-map-layers" aria-label="Layer peta">
        <button type="button" className={showTrips ? "active" : ""} onClick={() => setShowTrips((v) => !v)}>Trip</button>
        <button type="button" className={showGeofences ? "active" : ""} onClick={() => setShowGeofences((v) => !v)}>Geofence</button>
      </div>
      {error && <div className="fleet-map-empty fleet-map-status" role="alert">Peta OpenStreetMap belum merespons. Periksa koneksi internet lalu muat ulang halaman.</div>}
      {!error && ready && !positioned.length && emptyMessage?.trim() && (
        <div className="fleet-map-empty fleet-map-status" role="status">{emptyMessage}</div>
      )}
      {!error && !ready && <div className="fleet-map-empty fleet-map-status" role="status">Memuat peta OpenStreetMap…</div>}
    </div>
  );
}
