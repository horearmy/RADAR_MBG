"use client";

// Tracking GPS Driver. Aturan:
// - Hanya aktif saat `active` true (trip berjalan) DAN izin lokasi sudah diberikan.
// - Izin tidak pernah diminta otomatis; hanya lewat requestPermission() dari aksi pengguna.
// - Lokasi tidak pernah dipalsukan. Tanpa fix GPS nyata, tidak ada yang dikirim.
// - Antrean offline dibatasi kapasitas & masa simpan, memakai idempotency key,
//   dipisahkan per user, dan dibersihkan saat logout (clearFieldCaches).

import { useCallback, useEffect, useRef, useState } from "react";
import { appendTripLocation, type TripLocationInput } from "@/lib/api";
import { FIELD_STORAGE_PREFIX } from "@/lib/field-api";

export type GpsPermission = "unknown" | "prompt" | "granted" | "denied" | "revoked" | "unsupported";

export type GpsFix = { latitude: number; longitude: number; accuracyMeters: number; deviceTimestamp: string };

const SEND_INTERVAL_MS = 20_000;
const STALE_AFTER_MS = 90_000;
const POOR_ACCURACY_M = 50;
const QUEUE_MAX = 200;
const QUEUE_TTL_MS = 30 * 60 * 1000;

type QueueItem = { key: string; tripId: string; input: TripLocationInput; queuedAt: number };

export function getGpsFix(): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("GPS_UNSUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          deviceTimestamp: new Date(pos.timestamp).toISOString(),
        }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? "GPS_DENIED" : "GPS_UNAVAILABLE")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

function loadQueue(storageKey: string): QueueItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    const now = Date.now();
    return parsed.filter((item) => now - item.queuedAt < QUEUE_TTL_MS).slice(-QUEUE_MAX);
  } catch {
    return [];
  }
}

function saveQueue(storageKey: string, queue: QueueItem[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(queue.slice(-QUEUE_MAX)));
  } catch {
    // abaikan bila storage penuh/diblokir
  }
}

export function useTripTracking({
  userId,
  tripId,
  active,
  onUnauthenticated,
}: {
  userId: string | null;
  tripId: string | null;
  active: boolean;
  onUnauthenticated?: () => void;
}) {
  const [permission, setPermission] = useState<GpsPermission>("unknown");
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [watchError, setWatchError] = useState<string | null>(null);

  const queueRef = useRef<QueueItem[]>([]);
  const flushingRef = useRef(false);
  const lastEnqueueRef = useRef(0);
  const backoffRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const wasGrantedRef = useRef(false);
  const unauthRef = useRef(onUnauthenticated);
  useEffect(() => {
    unauthRef.current = onUnauthenticated;
  }, [onUnauthenticated]);

  const storageKey = userId ? `${FIELD_STORAGE_PREFIX}gps_queue_${userId}` : null;

  // Status izin (termasuk saat dicabut di pengaturan perangkat).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      queueMicrotask(() => setPermission("unsupported"));
      return;
    }
    if (!navigator.permissions?.query) {
      queueMicrotask(() => setPermission("prompt"));
      return;
    }
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const apply = (state: PermissionState) => {
      if (state === "granted") {
        wasGrantedRef.current = true;
        setPermission("granted");
      } else if (state === "denied") {
        setPermission(wasGrantedRef.current ? "revoked" : "denied");
      } else {
        setPermission("prompt");
      }
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (cancelled) return;
        status = result;
        apply(result.state);
        result.onchange = () => apply(result.state);
      })
      .catch(() => {
        if (!cancelled) setPermission("prompt");
      });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  // Penanda waktu untuk deteksi data stale.
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const flush = useCallback(async () => {
    if (flushingRef.current || !storageKey) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current[0];
        if (Date.now() - item.queuedAt >= QUEUE_TTL_MS) {
          queueRef.current.shift();
          continue;
        }
        try {
          await appendTripLocation(item.tripId, item.input, item.key);
          queueRef.current.shift();
          backoffRef.current = 0;
          setLastSentAt(Date.now());
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "UNAUTHENTICATED") {
            queueRef.current = [];
            unauthRef.current?.();
            return;
          }
          // Penolakan permanen dari server (trip tidak aktif/bukan assignment): buang item.
          if (/^REQUEST_FAILED_4(00|03|04|09|22)$/.test(message) || message === "ILLEGAL_TRIP_TRANSITION") {
            queueRef.current.shift();
            continue;
          }
          // Gagal sementara: coba lagi dengan backoff eksponensial (maks 2 menit).
          backoffRef.current = Math.min(backoffRef.current ? backoffRef.current * 2 : 5_000, 120_000);
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => void flush(), backoffRef.current);
          return;
        }
      }
    } finally {
      saveQueue(storageKey, queueRef.current);
      setPending(queueRef.current.length);
      flushingRef.current = false;
    }
  }, [storageKey]);

  // Pulihkan antrean milik user ini (bukan milik user sebelumnya).
  useEffect(() => {
    if (!storageKey) return;
    queueRef.current = loadQueue(storageKey);
    queueMicrotask(() => setPending(queueRef.current.length));
    if (queueRef.current.length > 0) void flush();
  }, [storageKey, flush]);

  // Kirim ulang saat koneksi kembali.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  // Watch GPS hanya selama trip aktif dan izin diberikan.
  useEffect(() => {
    if (!active || !tripId || !storageKey || permission !== "granted") return;
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const at = Date.now();
        setWatchError(null);
        setLastFixAt(at);
        setAccuracy(pos.coords.accuracy);
        if (at - lastEnqueueRef.current < SEND_INTERVAL_MS) return;
        lastEnqueueRef.current = at;
        queueRef.current.push({
          key: crypto.randomUUID(),
          tripId,
          queuedAt: at,
          input: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            deviceTimestamp: new Date(pos.timestamp).toISOString(),
            ...(pos.coords.speed != null && !Number.isNaN(pos.coords.speed) ? { speedMps: pos.coords.speed } : {}),
            ...(pos.coords.heading != null && !Number.isNaN(pos.coords.heading)
              ? { headingDegrees: pos.coords.heading }
              : {}),
          },
        });
        if (queueRef.current.length > QUEUE_MAX) queueRef.current.splice(0, queueRef.current.length - QUEUE_MAX);
        saveQueue(storageKey, queueRef.current);
        setPending(queueRef.current.length);
        void flush();
      },
      (err) => {
        setWatchError(err.code === err.PERMISSION_DENIED ? "GPS_DENIED" : "GPS_UNAVAILABLE");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, tripId, storageKey, permission, flush]);

  useEffect(
    () => () => {
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    },
    [],
  );

  /** Dipanggil dari aksi pengguna (tombol), tidak pernah otomatis. */
  const requestPermission = useCallback(async (): Promise<GpsFix | null> => {
    try {
      const fix = await getGpsFix();
      wasGrantedRef.current = true;
      setPermission("granted");
      return fix;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "GPS_DENIED") setPermission((p) => (p === "granted" ? "revoked" : "denied"));
      else if (message === "GPS_UNSUPPORTED") setPermission("unsupported");
      return null;
    }
  }, []);

  const tracking = active && permission === "granted" && !watchError;
  const freshAt = lastSentAt ?? lastFixAt;
  const stale = tracking && (freshAt === null || now - freshAt > STALE_AFTER_MS);
  const poorAccuracy = accuracy !== null && accuracy > POOR_ACCURACY_M;

  return {
    permission,
    tracking,
    stale,
    poorAccuracy,
    accuracy,
    lastFixAt,
    lastSentAt,
    pending,
    watchError,
    requestPermission,
  };
}
