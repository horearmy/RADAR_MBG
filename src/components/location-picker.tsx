"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const L = typeof window !== "undefined" ? require("leaflet") : null;
if (L) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

interface LocationPickerProps {
  latitude?: number | string;
  longitude?: number | string;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: string;
}

export function LocationPicker({ latitude, longitude, onLocationSelect, height = "300px" }: LocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initialLat = latitude ? Number(latitude) : -6.2;
    const initialLng = longitude ? Number(longitude) : 106.816666;

    map.current = L.map(mapContainer.current!).setView([initialLat, initialLng], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map.current);

    map.current!.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);

      if (marker.current) {
        marker.current.setLatLng([lat, lng]);
      } else {
        marker.current = L.marker([lat, lng]).addTo(map.current!);
      }
    });

    // Add initial marker if coordinates exist
    if (latitude && longitude) {
      marker.current = L.marker([initialLat, initialLng]).addTo(map.current);
    }

    setIsReady(true);

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update marker when coordinates change externally
  useEffect(() => {
    if (!map.current || !isReady) return;
    if (latitude && longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (marker.current) {
        marker.current.setLatLng([lat, lng]);
      } else {
        marker.current = L.marker([lat, lng]).addTo(map.current);
      }
      map.current.setView([lat, lng], 14);
    }
  }, [latitude, longitude, isReady]);

  return (
    <div style={{ height, width: "100%", position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid #dce4ef" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {!isReady && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f7fb" }}>
          <span style={{ color: "#7b8a9d", fontSize: "12px" }}>Memuat peta...</span>
        </div>
      )}
    </div>
  );
}
