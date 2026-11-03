"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker, GeoJSONSource } from "maplibre-gl";

type NavigationProps = {
  origin: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number; name: string };
  onStartLiveGps?: () => void;
  liveGpsActive?: boolean;
};

type RouteData = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}

export function DriverNavigation({ origin, destination, onStartLiveGps, liveGpsActive = false }: NavigationProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const destinationMarkerRef = useRef<MapLibreMarker | null>(null);
  const routeRequestIdRef = useRef(0);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map (client-only, maplibre loaded via dynamic import)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;
    void import("maplibre-gl")
      .then((ml) => {
        if (cancelled || !mapContainer.current) return;

        ml.setWorkerUrl("/maplibre-gl-worker.mjs");

        const map = new ml.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          },
          center: [origin?.longitude ?? 106.8456, origin?.latitude ?? -6.2088],
          zoom: 13,
        });

        map.addControl(new ml.NavigationControl(), "top-right");

        const geolocate = new ml.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: true,
        });
        map.addControl(geolocate, "top-right");

        map.on("load", () => {
          setMapReady(true);
        });

        mapRef.current = map;
      })
      .catch((err) => {
        console.error("Map init error:", err);
        setRouteError("Gagal memuat peta");
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch route when origin or destination changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!origin) {
      setRouteError("Menunggu sinyal GPS...");
      return;
    }

    const requestId = ++routeRequestIdRef.current;
    const fetchRoute = async () => {
      setLoadingRoute(true);
      setRouteError(null);
      try {
        const osrmUrl = process.env.NEXT_PUBLIC_OSRM_URL ?? "https://router.project-osrm.org";
        const url = `${osrmUrl}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (requestId !== routeRequestIdRef.current) return;

        if (data.routes && data.routes.length > 0) {
          const routeData = data.routes[0];
          setRoute({
            distance: routeData.distance,
            duration: routeData.duration,
            geometry: routeData.geometry,
          });

          const map = mapRef.current;
          if (!map) return;

          const ml = await import("maplibre-gl");
          if (requestId !== routeRequestIdRef.current) return;

          const source = map.getSource("route") as GeoJSONSource | undefined;
          if (source) {
            source.setData({
              type: "Feature",
              properties: {},
              geometry: routeData.geometry,
            });
          } else {
            map.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: routeData.geometry,
              },
            });
            map.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#1677ff", "line-width": 5 },
            });
          }

          // Fit bounds to show entire route
          const coordinates = routeData.geometry.coordinates as [number, number][];
          if (coordinates.length > 0) {
            const bounds = new ml.LngLatBounds(coordinates[0], coordinates[0]);
            for (const coord of coordinates) {
              bounds.extend(coord);
            }
            map.fitBounds(bounds, { padding: 50 });
          }
        }
      } catch (err) {
        if (requestId !== routeRequestIdRef.current) return;
        setRouteError("Gagal memuat rute");
        console.error("Route error:", err);
      } finally {
        if (requestId === routeRequestIdRef.current) {
          setLoadingRoute(false);
        }
      }
    };

    void fetchRoute();
  }, [origin, destination, mapReady]);

  // Update destination marker
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    void import("maplibre-gl")
      .then((ml) => {
        if (!mapRef.current) return;

        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.remove();
        }

        const el = document.createElement("div");
        el.style.cssText = "width:24px;height:24px;background:#ef4444;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);";
        const marker = new ml.Marker({ element: el })
          .setLngLat([destination.longitude, destination.latitude])
          .addTo(mapRef.current);
        destinationMarkerRef.current = marker;
      })
      .catch((err) => console.error("Marker error:", err));
  }, [destination, mapReady]);

  // Update current position marker
  useEffect(() => {
    if (!mapReady || !mapRef.current || !origin) return;

    void import("maplibre-gl")
      .then((ml) => {
        if (!mapRef.current) return;

        if (markerRef.current) {
          markerRef.current.setLngLat([origin.longitude, origin.latitude]);
        } else {
          const el = document.createElement("div");
          el.style.cssText = "width:20px;height:20px;background:#1677ff;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(22,119,255,0.5);";
          const marker = new ml.Marker({ element: el })
            .setLngLat([origin.longitude, origin.latitude])
            .addTo(mapRef.current);
          markerRef.current = marker;
        }
      })
      .catch((err) => console.error("Marker error:", err));
  }, [origin, mapReady]);

  return (
    <div className="driver-nav">
      <div className="driver-nav-map" ref={mapContainer} />

      <div className="driver-nav-info">
        <div className="driver-nav-destination">
          <strong>{destination.name}</strong>
          <span>Tujuan Pengiriman</span>
        </div>

        {loadingRoute && <div className="driver-nav-loading">Memuat rute...</div>}
        {routeError && !loadingRoute && <div className="driver-nav-error">{routeError}</div>}

        {route && (
          <div className="driver-nav-stats">
            <div className="driver-nav-stat">
              <strong>{formatDistance(route.distance)}</strong>
              <span>Jarak</span>
            </div>
            <div className="driver-nav-stat">
              <strong>{formatDuration(route.duration)}</strong>
              <span>Estimasi</span>
            </div>
          </div>
        )}

        {onStartLiveGps && (
          <button
            type="button"
            className={`driver-nav-gps-btn ${liveGpsActive ? "active" : ""}`}
            onClick={onStartLiveGps}
          >
            {liveGpsActive ? "🔴 Live GPS Aktif" : "📍 Mulai Live GPS"}
          </button>
        )}
      </div>
    </div>
  );
}
