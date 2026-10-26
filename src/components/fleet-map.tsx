"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";
import type { TripSummary } from "@/lib/api";

const JAKARTA_CENTER: [number, number] = [106.8456, -6.2088];

const rasterFallback: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function markerColor(trip: TripSummary) {
  if (trip.status === "CANCELLED" || trip.status === "EXCEPTION") return "#c05c52";
  if (trip.verificationStatus === "VERIFIED" || trip.verificationStatus === "OVERRIDDEN") return "#16885f";
  if (trip.status === "ARRIVAL_DETECTED" || trip.status === "DELIVERY_IN_PROGRESS") return "#715bb5";
  if (trip.status === "IN_TRANSIT" || trip.status === "ARRIVAL_VERIFIED") return "#2f74d0";
  return "#b97620";
}

function popupContent(trip: TripSummary, position: TripSummary["positions"][number]) {
  const node = document.createElement("div");
  node.style.cssText = "min-width:190px;font-family:inherit;color:#26364d;line-height:1.5";
  const heading = document.createElement("strong");
  heading.style.cssText = "display:block;font-size:12px;margin-bottom:2px";
  heading.textContent = `${trip.vehicle.plateNumber} · ${trip.driver.name}`;
  const route = document.createElement("span");
  route.style.cssText = "display:block;font-size:11px;color:#617590";
  route.textContent = `${trip.sppg.name} → ${trip.deliveryLocation.name}`;
  const meta = document.createElement("span");
  meta.style.cssText = "display:block;margin-top:6px;font-size:10px;color:#8293a9";
  const received = new Date(position.serverReceivedAt);
  meta.textContent = `GPS ${received.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB · akurasi ${Number(position.accuracyMeters ?? 0).toFixed(0)} m`;
  node.append(heading, route, meta);
  return node;
}

export function FleetMap({ trips }: { trips: TripSummary[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const positioned = trips.filter((trip) => trip.positions.length > 0);

  useEffect(() => {
    let cancelled = false;
    let loadTimeout: number | undefined;

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled || !containerRef.current) return;
        maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
        const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl || rasterFallback,
          center: JAKARTA_CENTER,
          zoom: 10.5,
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }));
        mapRef.current = map;
        let loaded = false;
        map.once("load", () => {
          if (cancelled) return;
          loaded = true;
          window.clearTimeout(loadTimeout);
          setError(false);
          setReady(true);
          map.resize();
        });
        loadTimeout = window.setTimeout(() => {
          if (cancelled || loaded) return;
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
      fittedRef.current = false;
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
        const position = trip.positions[0];
        if (!position) continue;
        const latitude = Number(position.latitude);
        const longitude = Number(position.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        const element = document.createElement("button");
        element.type = "button";
        element.className = "fleet-marker";
        element.style.backgroundColor = markerColor(trip);
        element.title = `${trip.vehicle.plateNumber} · ${trip.driver.name}`;
        element.setAttribute(
          "aria-label",
          `${trip.vehicle.plateNumber}, ${trip.driver.name}, ${trip.status}`,
        );

        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setDOMContent(
          popupContent(trip, position),
        );
        element.addEventListener("click", () => {
          popup.setLngLat([longitude, latitude]).addTo(map);
        });

        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([longitude, latitude])
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([longitude, latitude]);
      }

      if (!fittedRef.current && markersRef.current.length) {
        map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 0 });
        fittedRef.current = true;
      }
    });

    return () => { active = false; };
  }, [trips, ready]);

  return (
    <div className="fleet-map">
      <div ref={containerRef} className="fleet-map-canvas" />
      {error && <div className="fleet-map-empty" role="alert">Peta belum merespons. Periksa koneksi internet atau URL style MapLibre, lalu muat ulang halaman.</div>}
      {!error && ready && !positioned.length && (
        <div className="fleet-map-empty" role="status">Belum ada posisi GPS untuk perjalanan hari ini.</div>
      )}
      {!error && !ready && <div className="fleet-map-empty" role="status">Memuat peta…</div>}
    </div>
  );
}
