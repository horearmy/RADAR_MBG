"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, Settings2, X } from "lucide-react";
import {
  DEV_TRIP_STATUSES,
  DEV_TRIP_STATUS_LABELS,
  getDevTrips,
  isDevToolsAvailable,
  setDevTripStatus,
  type DevTrip,
  type DevTripStatus,
} from "@/lib/field-api";

type DevToolsProps = {
  onStatusChanged?: () => void;
};

export function DevTools({ onStatusChanged }: DevToolsProps) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<DevTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await getDevTrips());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat trips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && trips.length === 0 && !loading) {
      void loadTrips();
    }
  }, [open, trips.length, loading, loadTrips]);

  async function changeStatus(tripId: string, status: DevTripStatus) {
    if (busyTripId) return;
    setBusyTripId(tripId);
    setError(null);
    try {
      await setDevTripStatus(tripId, status);
      await loadTrips();
      onStatusChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setBusyTripId(null);
    }
  }

  function previewPod(tripId: string) {
    window.dispatchEvent(new CustomEvent("devtools:preview-pod", { detail: { tripId } }));
  }

  // Hanya tampil di development — hooks di atas sudah dipanggil dengan urutan yang sama.
  if (!isDevToolsAvailable()) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        className="dev-tools-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup DevTools" : "Buka DevTools"}
        title="DevTools (development)"
      >
        {open ? <X size={18} /> : <Settings2 size={18} />}
        {!open && <span className="dev-tools-fab-label">Dev</span>}
      </button>

      {/* Panel */}
      {open && (
        <div className="dev-tools-panel" role="dialog" aria-label="DevTools">
          <div className="dev-tools-header">
            <h3>DevTools</h3>
            <button type="button" className="dev-tools-close" onClick={() => setOpen(false)} aria-label="Tutup">
              <X size={16} />
            </button>
          </div>

          <p className="dev-tools-hint">
            Ubah status trip untuk testing fitur. Perubahan langsung tersimpan di database.
          </p>

          {error && <div className="dev-tools-error">{error}</div>}

          <div className="dev-tools-trip-list">
            {loading && trips.length === 0 ? (
              <p className="dev-tools-hint">Memuat trips...</p>
            ) : trips.length === 0 ? (
              <p className="dev-tools-hint">Tidak ada trip untuk driver ini.</p>
            ) : (
              trips.map((trip) => (
                <div key={trip.id} className="dev-tools-trip">
                  <div className="dev-tools-trip-info">
                    <strong>{trip.deliveryLocation.name}</strong>
                    <span className={`dev-tools-badge dev-tools-badge-${trip.status.toLowerCase()}`}>
                      {DEV_TRIP_STATUS_LABELS[trip.status as DevTripStatus] ?? trip.status}
                    </span>
                    <span className="dev-tools-trip-meta">
                      {trip.id.slice(0, 8)} · {trip.plannedQuantity} porsi
                    </span>
                  </div>
                  <div className="dev-tools-status-grid">
                    {DEV_TRIP_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`dev-tools-status-btn ${trip.status === status ? "active" : ""}`}
                        onClick={() => changeStatus(trip.id, status)}
                        disabled={busyTripId === trip.id || trip.status === status}
                        title={DEV_TRIP_STATUS_LABELS[status]}
                      >
                        {DEV_TRIP_STATUS_LABELS[status]}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="dev-tools-status-btn dev-tools-preview-pod"
                      onClick={() => previewPod(trip.id)}
                      disabled={busyTripId === trip.id}
                      title="Buka form POD (preview)"
                    >
                      <Eye size={11} /> Preview POD
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="dev-tools-refresh"
            onClick={() => void loadTrips()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Muat Ulang
          </button>
        </div>
      )}
    </>
  );
}
