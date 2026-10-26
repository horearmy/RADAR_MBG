"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Crosshair,
  FileCheck2,
  LocateFixed,
  MapPin,
  Navigation,
  PackageCheck,
  QrCode,
  Radio,
  RefreshCw,
  ShieldCheck,
  Truck,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import {
  appendTripLocation,
  getCurrentSession,
  getSessionRole,
  getTrips,
  hasPermission,
  startTrip,
  startTripDelivery,
  submitTripDelivery,
  uploadTripProof,
  verifyTripArrival,
  type SessionUser,
  type TripSummary,
} from "@/lib/api";
import { useOnlineStatus } from "@/lib/use-online-status";

type LoadState = "checking" | "ready" | "forbidden" | "error" | "unavailable";
type DriverTab = "active" | "history";
type TrackingState = "off" | "starting" | "on" | "error";
type Tone = "blue" | "amber" | "violet" | "green" | "red";
type ScannerState = "starting" | "scanning" | "error";
type BarcodeResult = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const activeStatuses = new Set([
  "READY_TO_DEPART",
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
  "DELIVERED",
]);

const statusLabels: Record<string, string> = {
  DRAFT: "Draf",
  SCHEDULED: "Terjadwal",
  READY_TO_DEPART: "Siap berangkat",
  IN_TRANSIT: "Dalam perjalanan",
  ARRIVAL_DETECTED: "Tiba di tujuan",
  ARRIVAL_VERIFIED: "Kedatangan terverifikasi",
  DELIVERY_IN_PROGRESS: "Serah-terima",
  DELIVERED: "POD tersimpan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  EXCEPTION: "Exception",
};

const statusTones: Record<string, Tone> = {
  DRAFT: "blue",
  SCHEDULED: "blue",
  READY_TO_DEPART: "amber",
  IN_TRANSIT: "blue",
  ARRIVAL_DETECTED: "violet",
  ARRIVAL_VERIFIED: "violet",
  DELIVERY_IN_PROGRESS: "amber",
  DELIVERED: "green",
  COMPLETED: "green",
  CANCELLED: "red",
  EXCEPTION: "red",
};

const arrivalReasonLabels: Record<string, string> = {
  INVALID_OR_EXPIRED_TOKEN: "Token QR tidak valid atau sudah kedaluwarsa.",
  TOKEN_CONTEXT_MISMATCH: "Token QR bukan untuk tujuan perjalanan ini.",
  TOKEN_ALREADY_USED: "Token QR sudah pernah digunakan.",
  TOKEN_EXPIRED: "Token QR sudah kedaluwarsa. Minta token baru ke admin SPPG.",
  ARRIVAL_GEOFENCE_NOT_CONFIRMED: "Sistem belum mendeteksi kedatangan di geofence tujuan.",
  DESTINATION_GEOFENCE_NOT_CONFIGURED: "Geofence tujuan belum dikonfigurasi. Hubungi admin.",
  GPS_ACCURACY_THRESHOLD: "Akurasi GPS belum memadai. Cari area terbuka lalu coba lagi.",
  GPS_TIMESTAMP_STALE_OR_INVALID: "Waktu GPS tidak valid. Aktifkan waktu otomatis lalu coba lagi.",
  OUTSIDE_DESTINATION_GEOFENCE: "Anda masih berada di luar area tujuan.",
};

function actionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "UNAUTHENTICATED":
      return "Sesi berakhir. Silakan masuk kembali.";
    case "TRIP_NOT_FOUND":
      return "Perjalanan tidak ditemukan atau bukan tugas Anda.";
    case "DRIVER_ASSIGNMENT_REQUIRED":
      return "Perjalanan ini bukan tugas pengemudi yang sedang masuk.";
    case "ORIGIN_GEOFENCE_NOT_CONFIGURED":
      return "Geofence SPPG asal belum dikonfigurasi. Hubungi admin SPPG.";
    case "OUTSIDE_DEPARTURE_GEOFENCE":
      return "Anda belum berada di area SPPG asal. Dekati lokasi lalu coba lagi.";
    case "GPS_ACCURACY_INSUFFICIENT":
      return "Akurasi GPS belum cukup. Pindah ke area terbuka lalu coba lagi.";
    case "GPS_TIMESTAMP_INVALID":
      return "Waktu GPS tidak valid. Aktifkan tanggal dan waktu otomatis.";
    case "GPS_RATE_LIMITED":
      return "Pengiriman GPS terlalu sering. Tunggu satu menit lalu coba lagi.";
    case "TRIP_NOT_TRACKABLE":
      return "Perjalanan ini tidak sedang dalam status dapat dilacak.";
    case "ILLEGAL_TRIP_TRANSITION":
    case "TRIP_CHANGED_RETRY":
      return "Status perjalanan berubah. Muat ulang lalu coba lagi.";
    case "TRIP_NOT_READY_FOR_QR":
      return "Token QR belum tersedia untuk perjalanan ini.";
    case "QR_RATE_LIMITED":
      return "Terlalu banyak percobaan verifikasi. Tunggu sebentar.";
    case "DELIVERY_NOT_IN_PROGRESS":
      return "Serah-terima belum dimulai atau sudah selesai.";
    case "DELIVERY_QUANTITY_EXCEEDS_DISPATCH":
      return "Jumlah diterima dan rusak melebihi jumlah yang dikirim.";
    case "VARIANCE_REASON_REQUIRED":
      return "Alasan selisih wajib diisi.";
    case "DISPATCH_QUANTITY_REQUIRED":
      return "Jumlah porsi yang dikirim belum tersedia.";
    case "DELIVERY_RECORD_ALREADY_SUBMITTED":
      return "POD sudah disubmit untuk perjalanan ini.";
    case "DELIVERY_RECORD_REQUIRED":
      return "Submit POD terlebih dahulu sebelum mengunggah bukti.";
    case "PROOF_FILE_REQUIRED":
      return "Pilih file bukti terlebih dahulu.";
    case "PROOF_FILE_TOO_LARGE":
      return "Ukuran bukti maksimal 10 MB.";
    case "PROOF_FILE_TYPE_UNSUPPORTED":
      return "Format bukti harus JPG, PNG, WEBP, atau PDF.";
    case "TRIP_CANCELLED":
      return "Perjalanan sudah dibatalkan.";
    case "IDEMPOTENCY_KEY_REUSED":
      return "Permintaan sebelumnya sudah diproses. Muat ulang data.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk aksi ini.";
    case "REQUEST_FAILED_404":
      return "Data tidak ditemukan atau berada di luar scope akses.";
    case "REQUEST_FAILED_429":
      return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    case "GEOLOCATION_UNSUPPORTED":
      return "Perangkat ini tidak mendukung GPS browser.";
    case "GEOLOCATION_DENIED":
      return "Izin lokasi ditolak. Aktifkan izin lokasi untuk RADAR MBG.";
    case "GEOLOCATION_UNAVAILABLE":
      return "Lokasi tidak tersedia. Pastikan GPS aktif dan sinyal memadai.";
    case "GEOLOCATION_TIMEOUT":
      return "Pencarian lokasi terlalu lama. Coba lagi di area terbuka.";
    default:
      return "Aksi gagal diproses. Periksa koneksi lalu coba lagi.";
  }
}

function scannerErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError") {
      return "Izin kamera ditolak. Aktifkan izin kamera untuk RADAR MBG atau tempel token manual.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "Kamera belakang tidak ditemukan. Gunakan kamera lain atau tempel token manual.";
    }
    if (error.name === "NotReadableError") {
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
    }
  }
  return "Kamera QR tidak dapat dimulai. Tempel token verifikasi secara manual.";
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEOLOCATION_UNSUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      if (error.code === error.PERMISSION_DENIED) reject(new Error("GEOLOCATION_DENIED"));
      else if (error.code === error.TIMEOUT) reject(new Error("GEOLOCATION_TIMEOUT"));
      else reject(new Error("GEOLOCATION_UNAVAILABLE"));
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function positionPayload(position: GeolocationPosition) {
  const accuracyMeters = Math.min(
    10_000,
    Math.max(0, Math.round(position.coords.accuracy * 100) / 100),
  );
  const speedMps = position.coords.speed !== null && position.coords.speed >= 0
    ? Math.round(position.coords.speed * 100) / 100
    : undefined;
  const headingDegrees = position.coords.heading !== null && position.coords.heading >= 0
    ? Math.round(position.coords.heading * 100) / 100
    : undefined;
  return {
    latitude: Math.round(position.coords.latitude * 1_000_000) / 1_000_000,
    longitude: Math.round(position.coords.longitude * 1_000_000) / 1_000_000,
    accuracyMeters,
    deviceTimestamp: new Date(position.timestamp || Date.now()).toISOString(),
    speedMps,
    headingDegrees,
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "baru saja";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`status-pill status-${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}

function tripLabel(trip: TripSummary) {
  return `TRP-${trip.id.slice(0, 8).toUpperCase()}`;
}

export default function DriverPage() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [reloadKey, setReloadKey] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tab, setTab] = useState<DriverTab>("active");
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [qrTokens, setQrTokens] = useState<Record<string, string>>({});
  const [podTripId, setPodTripId] = useState<string | null>(null);
  const [podReceived, setPodReceived] = useState("");
  const [podDamaged, setPodDamaged] = useState("0");
  const [podReason, setPodReason] = useState("");
  const [podNote, setPodNote] = useState("");
  const [proofTripId, setProofTripId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofInputKey, setProofInputKey] = useState(0);

  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingState>("off");
  const [trackingMessage, setTrackingMessage] = useState("");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const sendInFlightRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const [scannerTripId, setScannerTripId] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("starting");
  const [scannerError, setScannerError] = useState("");
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanRunRef = useRef(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoadState((current) => (current === "ready" ? "ready" : "checking"));
      let user: SessionUser;
      try {
        user = await getCurrentSession();
      } catch (sessionError: unknown) {
        if (!active) return;
        if (sessionError instanceof Error && sessionError.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setLoadState("unavailable");
        return;
      }
      if (!active) return;
      setSessionUser(user);

      const canDrive = hasPermission(user, "trip:start") &&
        hasPermission(user, "trip:location:update");
      if (!canDrive) {
        setLoadState("forbidden");
        return;
      }

      try {
        const result = await getTrips({ page: 1, pageSize: 100 });
        if (!active) return;
        setTrips(result.data);
        setLoadState("ready");
      } catch (tripError: unknown) {
        if (!active) return;
        if (tripError instanceof Error && tripError.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setLoadState(
          tripError instanceof Error && tripError.message === "REQUEST_FAILED_403"
            ? "forbidden"
            : "error",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey, router]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  function clearWatch() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }

  useEffect(() => {
    if (!scannerTripId) return;
    const tripId = scannerTripId;
    let cancelled = false;
    const runId = scanRunRef.current + 1;
    const videoElement = scanVideoRef.current;
    scanRunRef.current = runId;

    async function startCamera() {
      let stream: MediaStream | null = null;
      try {
        if (!window.isSecureContext) throw new Error("SCANNER_INSECURE");
        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (!Detector || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("SCANNER_UNSUPPORTED");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled || scanRunRef.current !== runId) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        scanStreamRef.current = stream;

        if (!videoElement) throw new Error("SCANNER_UNAVAILABLE");
        videoElement.srcObject = stream;
        await videoElement.play();
        if (cancelled || scanRunRef.current !== runId) return;

        const detector = new Detector({ formats: ["qr_code"] });
        setScannerState("scanning");

        const tick = async () => {
          if (cancelled || scanRunRef.current !== runId) return;
          try {
            const results = await detector.detect(videoElement);
            const value = results[0]?.rawValue?.trim();
            if (value) {
              setQrTokens((current) => ({ ...current, [tripId]: value }));
              setNotice("QR berhasil dipindai. Tekan Verifikasi tiba untuk melanjutkan.");
              setScannerTripId(null);
              return;
            }
          } catch {
            scanTimerRef.current = null;
          }
          if (!cancelled && scanRunRef.current === runId) {
            scanTimerRef.current = window.setTimeout(() => void tick(), 350);
          }
        };
        scanTimerRef.current = window.setTimeout(() => void tick(), 300);
      } catch (error: unknown) {
        if (cancelled) return;
        if (stream) stream.getTracks().forEach((track) => track.stop());
        scanStreamRef.current = null;
        setScannerState("error");
        setScannerError(
          error instanceof Error && error.message === "SCANNER_UNSUPPORTED"
            ? "Browser ini belum mendukung pemindaian QR kamera. Tempel token manual."
            : error instanceof Error && error.message === "SCANNER_INSECURE"
              ? "Kamera hanya tersedia melalui HTTPS. Tempel token manual."
              : scannerErrorMessage(error),
        );
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      scanRunRef.current += 1;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
      if (scanStreamRef.current) {
        scanStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      scanStreamRef.current = null;
      if (videoElement) videoElement.srcObject = null;
    };
  }, [scannerTripId]);

  function requireOnline() {
    if (isOnline) return true;
    setError("Anda sedang offline. Sambungkan internet sebelum mengirim aksi ke server.");
    return false;
  }

  function openScanner(tripId: string) {
    setError("");
    setNotice("");
    setScannerError("");
    setScannerState("starting");
    setScannerTripId(tripId);
  }

  function stopScanner() {
    setScannerTripId(null);
    setScannerError("");
    setScannerState("starting");
  }

  function stopTracking() {
    clearWatch();
    setTrackingTripId(null);
    setTrackingState("off");
    setTrackingMessage("");
  }

  async function sendTrackedPosition(tripId: string, position: GeolocationPosition) {
    if (sendInFlightRef.current) return;
    const now = new Date().getTime();
    if (now - lastSendAtRef.current < 15_000) return;

    lastSendAtRef.current = now;
    sendInFlightRef.current = true;
    try {
      const payload = positionPayload(position);
      await appendTripLocation(tripId, payload);
      setLastSentAt(new Date().toISOString());
      setTrackingState("on");
      setTrackingMessage(`GPS terkirim - akurasi ${payload.accuracyMeters.toFixed(0)} m`);
    } catch (trackingError: unknown) {
      setTrackingState("error");
      setTrackingMessage(actionErrorMessage(trackingError));
    } finally {
      sendInFlightRef.current = false;
    }
  }

  function beginTracking(tripId: string) {
    clearWatch();
    if (!navigator.geolocation) {
      setTrackingState("error");
      setTrackingMessage("Perangkat ini tidak mendukung GPS browser.");
      return;
    }

    lastSendAtRef.current = 0;
    setTrackingTripId(tripId);
    setTrackingState("starting");
    setTrackingMessage("Menunggu sinyal GPS...");
    setLastSentAt(null);

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void sendTrackedPosition(tripId, position);
      },
      (geoError) => {
        setTrackingState("error");
        setTrackingMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk RADAR MBG."
            : geoError.code === geoError.TIMEOUT
              ? "Sinyal GPS terlalu lama. Coba di area terbuka."
              : "Lokasi tidak tersedia. Pastikan GPS aktif.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  function toggleTracking(trip: TripSummary) {
    if (trackingTripId === trip.id) {
      stopTracking();
      return;
    }
    beginTracking(trip.id);
  }

  async function handleStart(trip: TripSummary) {
    if (!requireOnline()) return;
    setError("");
    setNotice("");
    setBusyTripId(trip.id);
    try {
      const position = await currentPosition();
      const payload = positionPayload(position);
      await startTrip(trip.id, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: payload.accuracyMeters,
        deviceTimestamp: payload.deviceTimestamp,
      });
      setNotice(`${tripLabel(trip)} dimulai. GPS akan dikirim selama perjalanan.`);
      beginTracking(trip.id);
      refresh();
    } catch (startError: unknown) {
      setError(actionErrorMessage(startError));
    } finally {
      setBusyTripId(null);
    }
  }

  async function handleVerify(trip: TripSummary) {
    if (!requireOnline()) return;
    const qrToken = (qrTokens[trip.id] ?? "").trim();
    setError("");
    setNotice("");
    if (qrToken.length < 32) {
      setError("Tempelkan token QR yang diberikan admin SPPG (minimal 32 karakter).");
      return;
    }

    setBusyTripId(trip.id);
    try {
      const position = await currentPosition();
      const payload = positionPayload(position);
      const result = await verifyTripArrival(trip.id, {
        qrToken,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: payload.accuracyMeters,
        deviceTimestamp: payload.deviceTimestamp,
      });
      if (result.result !== "VERIFIED") {
        setError(
          arrivalReasonLabels[result.reasonCode ?? ""] ??
            "Verifikasi kedatangan belum berhasil. Periksa lokasi dan token QR.",
        );
        return;
      }
      stopTracking();
      stopScanner();
      setQrTokens((current) => ({ ...current, [trip.id]: "" }));
      setNotice(`${tripLabel(trip)} terverifikasi. Lanjutkan serah-terima.`);
      refresh();
    } catch (verifyError: unknown) {
      setError(actionErrorMessage(verifyError));
    } finally {
      setBusyTripId(null);
    }
  }

  async function handleStartDelivery(trip: TripSummary) {
    if (!requireOnline()) return;
    setError("");
    setNotice("");
    setBusyTripId(trip.id);
    try {
      await startTripDelivery(trip.id);
      setNotice(`Serah-terima ${tripLabel(trip)} dimulai.`);
      refresh();
    } catch (deliveryError: unknown) {
      setError(actionErrorMessage(deliveryError));
    } finally {
      setBusyTripId(null);
    }
  }

  function openPod(trip: TripSummary) {
    setError("");
    setNotice("");
    setPodTripId(trip.id);
    setPodReceived(String(trip.dispatchedQuantity ?? trip.plannedQuantity));
    setPodDamaged("0");
    setPodReason("");
    setPodNote("");
  }

  async function handleSubmitPod(trip: TripSummary) {
    if (!requireOnline()) return;
    const dispatched = trip.dispatchedQuantity ?? trip.plannedQuantity;
    const received = Number(podReceived);
    const damaged = Number(podDamaged);
    setError("");
    setNotice("");

    if (!Number.isInteger(received) || received < 0) {
      setError("Jumlah diterima harus bilangan bulat 0 atau lebih.");
      return;
    }
    if (!Number.isInteger(damaged) || damaged < 0) {
      setError("Jumlah rusak harus bilangan bulat 0 atau lebih.");
      return;
    }
    if (received + damaged > dispatched) {
      setError(`Diterima + rusak tidak boleh melebihi ${dispatched} porsi yang dikirim.`);
      return;
    }
    const hasVariance = damaged > 0 || received + damaged < dispatched;
    if (hasVariance && !podReason.trim()) {
      setError("Alasan selisih wajib diisi bila ada porsi rusak atau kurang.");
      return;
    }

    setBusyTripId(trip.id);
    try {
      await submitTripDelivery(trip.id, {
        receivedQuantity: received,
        damagedQuantity: damaged,
        varianceReason: hasVariance ? podReason.trim() : undefined,
        confirmationNote: podNote.trim() || undefined,
        deviceTimestamp: new Date().toISOString(),
      });
      setPodTripId(null);
      setProofTripId(trip.id);
      setNotice(`POD ${tripLabel(trip)} tersimpan. Unggah bukti bila tersedia.`);
      refresh();
    } catch (podError: unknown) {
      setError(actionErrorMessage(podError));
    } finally {
      setBusyTripId(null);
    }
  }

  async function handleUploadProof(trip: TripSummary) {
    if (!requireOnline()) return;
    setError("");
    setNotice("");
    if (!proofFile) {
      setError("Pilih file bukti terlebih dahulu.");
      return;
    }

    setBusyTripId(trip.id);
    try {
      const result = await uploadTripProof(trip.id, proofFile);
      setNotice(
        result.deduplicated
          ? `Bukti ${tripLabel(trip)} sudah pernah diunggah sebelumnya.`
          : `Bukti ${tripLabel(trip)} berhasil diunggah.`,
      );
      setProofFile(null);
      setProofInputKey((value) => value + 1);
      setProofTripId(null);
      refresh();
    } catch (proofError: unknown) {
      setError(actionErrorMessage(proofError));
    } finally {
      setBusyTripId(null);
    }
  }

  if (loadState === "checking") {
    return (
      <main className="session-state">
        <span className="session-spinner" />
        <h1>Memuat tugas pengemudi</h1>
        <p>Memeriksa sesi dan perjalanan yang ditugaskan.</p>
      </main>
    );
  }

  if (loadState === "unavailable") {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Layanan belum tersedia</h1>
        <p>Mode pengemudi tidak dapat memverifikasi sesi. Pastikan API aktif.</p>
        <button className="session-retry" onClick={refresh}>Coba lagi</button>
      </main>
    );
  }

  if (loadState === "forbidden") {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Mode pengemudi tidak tersedia</h1>
        <p>Halaman ini hanya untuk pengemudi dengan izin mulai trip dan pengiriman GPS.</p>
        <Link className="session-retry" href="/">Kembali ke ringkasan</Link>
      </main>
    );
  }

  if (loadState === "error" || !sessionUser) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Tugas gagal dimuat</h1>
        <p>Sesi valid, tetapi daftar perjalanan tidak dapat dimuat dari API.</p>
        <div className="trip-error-actions">
          <Link className="session-retry" href="/"><ArrowLeft size={14} />Kembali</Link>
          <button className="session-retry" onClick={refresh}>
            <RefreshCw size={14} />Coba lagi
          </button>
        </div>
      </main>
    );
  }

  const activeTrips = trips.filter((trip) => activeStatuses.has(trip.status));
  const historyTrips = trips.filter((trip) => !activeStatuses.has(trip.status));
  const visibleTrips = tab === "active" ? activeTrips : historyTrips;
  const inTransitCount = trips.filter((trip) => trip.status === "IN_TRANSIT").length;
  const waitingVerifyCount = trips.filter((trip) => trip.status === "ARRIVAL_DETECTED").length;
  const completedCount = trips.filter(
    (trip) => trip.status === "DELIVERED" || trip.status === "COMPLETED",
  ).length;

  return (
    <main className="driver-page">
      <header className="trip-topbar driver-topbar">
        <Link className="trip-back" href="/">
          <ArrowLeft size={15} />
          Ringkasan
        </Link>
        <Link className="trip-brand" href="/" aria-label="RADAR MBG beranda">
          <span className="brand-mark"><span /><span /><span /></span>
          <strong>RADAR<span>MBG</span></strong>
        </Link>
        <div className="trip-user">
          <span className="trip-user-avatar">{sessionUser.displayName.slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{sessionUser.displayName}</strong>
            <small>{getSessionRole(sessionUser)}</small>
          </span>
        </div>
      </header>

      <div className="driver-content">
        <section className="driver-hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              DRIVER CONSOLE
            </div>
            <h1>Tugas hari ini</h1>
            <p>Mulai perjalanan, kirim GPS, verifikasi kedatangan, dan catat POD langsung dari perangkat.</p>
          </div>
          <button className="driver-refresh" onClick={refresh} aria-label="Muat ulang tugas">
            <RefreshCw size={15} />
            <span>Muat ulang</span>
          </button>
        </section>

        {!isOnline && (
          <div className="driver-offline-banner" role="status">
            <WifiOff size={18} />
            <div>
              <strong>Anda sedang offline</strong>
              <span>Aksi belum tersimpan otomatis. Sambungkan internet sebelum memulai trip, verifikasi, atau mengirim POD.</span>
            </div>
          </div>
        )}

        <section className="driver-stat-grid" aria-label="Ringkasan tugas">
          <article>
            <span className="driver-stat-icon stat-blue"><Truck size={17} /></span>
            <div><span>Tugas aktif</span><strong>{activeTrips.length}</strong></div>
          </article>
          <article>
            <span className="driver-stat-icon stat-amber"><Radio size={17} /></span>
            <div><span>Di jalan</span><strong>{inTransitCount}</strong></div>
          </article>
          <article>
            <span className="driver-stat-icon stat-violet"><QrCode size={17} /></span>
            <div><span>Menunggu verifikasi</span><strong>{waitingVerifyCount}</strong></div>
          </article>
          <article>
            <span className="driver-stat-icon stat-green"><PackageCheck size={17} /></span>
            <div><span>POD tersimpan</span><strong>{completedCount}</strong></div>
          </article>
        </section>

        {notice && (
          <div className="driver-banner driver-banner-success" role="status">
            <CheckCircle2 size={17} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Tutup notifikasi"><X size={14} /></button>
          </div>
        )}
        {error && (
          <div className="driver-banner driver-banner-error" role="alert">
            <AlertTriangle size={17} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Tutup pesan"><X size={14} /></button>
          </div>
        )}

        <div className="driver-tabs" role="tablist" aria-label="Filter tugas">
          <button
            className={tab === "active" ? "driver-tab driver-tab-active" : "driver-tab"}
            onClick={() => setTab("active")}
            role="tab"
            aria-selected={tab === "active"}
          >
            Aktif <span>{activeTrips.length}</span>
          </button>
          <button
            className={tab === "history" ? "driver-tab driver-tab-active" : "driver-tab"}
            onClick={() => setTab("history")}
            role="tab"
            aria-selected={tab === "history"}
          >
            Riwayat <span>{historyTrips.length}</span>
          </button>
        </div>

        <section className="driver-list" aria-label="Daftar perjalanan">
          {!visibleTrips.length && (
            <div className="driver-empty">
              <span><ShieldCheck size={22} /></span>
              <strong>{tab === "active" ? "Tidak ada tugas aktif" : "Belum ada riwayat"}</strong>
              <p>
                {tab === "active"
                  ? "Tugas baru akan muncul setelah dispatcher menugaskan perjalanan kepada Anda."
                  : "Perjalanan yang sudah selesai atau dibatalkan akan tampil di sini."}
              </p>
            </div>
          )}

          {visibleTrips.map((trip) => {
            const tone = statusTones[trip.status] ?? "blue";
            const label = statusLabels[trip.status] ?? trip.status;
            const busy = busyTripId === trip.id;
            const isTracking = trackingTripId === trip.id;
            const dispatched = trip.dispatchedQuantity ?? trip.plannedQuantity;
            const latestPosition = trip.positions[0] ?? null;
            const podReceivedNumber = Number(podReceived);
            const podDamagedNumber = Number(podDamaged);
            const podShortage = Number.isFinite(podReceivedNumber) && Number.isFinite(podDamagedNumber)
              ? dispatched - podReceivedNumber - podDamagedNumber
              : 0;
            const hasPodVariance = podDamagedNumber > 0 || podShortage > 0;

            return (
              <article
                className={isTracking ? "driver-card driver-card-live" : "driver-card"}
                key={trip.id}
              >
                <div className="driver-card-head">
                  <div>
                    <span className="driver-trip-id">{tripLabel(trip)}</span>
                    <span className="driver-trip-date">
                      {formatDate(trip.plannedDepartureAt)} - {formatTime(trip.plannedDepartureAt)} WIB
                    </span>
                  </div>
                  <StatusPill tone={tone}>{label}</StatusPill>
                </div>

                <div className="driver-route">
                  <div>
                    <span><MapPin size={12} />Asal</span>
                    <strong>{trip.sppg.name}</strong>
                  </div>
                  <ArrowRight size={17} />
                  <div>
                    <span><Crosshair size={12} />Tujuan</span>
                    <strong>{trip.deliveryLocation.name}</strong>
                  </div>
                </div>

                <div className="driver-meta">
                  <span><Truck size={13} />{trip.vehicle.plateNumber}</span>
                  <span><Clock3 size={13} />ETA {formatTime(trip.plannedArrivalAt)}</span>
                  <span><PackageCheck size={13} />{trip.plannedQuantity} porsi</span>
                  <span><Navigation size={13} />{trip.driver.name}</span>
                </div>

                {latestPosition && (
                  <div className="driver-gps-line">
                    <span className="driver-gps-dot" />
                    GPS terakhir {relativeTime(latestPosition.serverReceivedAt)} - akurasi{" "}
                    {Number(latestPosition.accuracyMeters ?? 0).toFixed(0)} m
                  </div>
                )}

                {isTracking && (
                  <div className={`driver-tracking driver-tracking-${trackingState}`}>
                    <span className="driver-tracking-icon"><LocateFixed size={16} /></span>
                    <div>
                      <strong>{trackingState === "error" ? "GPS terhenti" : "GPS aktif"}</strong>
                      <span>{trackingMessage || "Mengirim posisi secara berkala."}</span>
                      <small>
                        {lastSentAt ? `Terkirim ${formatTime(lastSentAt)} WIB` : "Belum ada posisi terkirim"}
                      </small>
                      <small>
                        Pelacakan hanya berjalan selama halaman dan browser aktif; tab tertutup atau layar terkunci dapat menghentikan GPS.
                      </small>
                    </div>
                    <button onClick={stopTracking}>Hentikan</button>
                  </div>
                )}

                <div className="driver-actions">
                  {trip.status === "READY_TO_DEPART" && (
                    <button
                      className="driver-primary-action"
                      onClick={() => void handleStart(trip)}
                      disabled={busy || !isOnline}
                    >
                      <Navigation size={16} />
                      {busy ? "Memulai..." : "Mulai perjalanan"}
                    </button>
                  )}

                  {trip.status === "IN_TRANSIT" && (
                    <button
                      className={isTracking ? "driver-secondary-action driver-stop-action" : "driver-primary-action"}
                      onClick={() => toggleTracking(trip)}
                      disabled={!isOnline && !isTracking}
                    >
                      {isTracking ? <Radio size={16} /> : <LocateFixed size={16} />}
                      {isTracking ? "Hentikan GPS" : "Aktifkan GPS"}
                    </button>
                  )}

                  {trip.status === "ARRIVAL_DETECTED" && (
                    <div className="driver-qr-box">
                      <label htmlFor={`qr-${trip.id}`}>Token QR dari admin SPPG</label>
                      <div>
                        <input
                          id={`qr-${trip.id}`}
                          value={qrTokens[trip.id] ?? ""}
                          onChange={(event) => setQrTokens((current) => ({
                            ...current,
                            [trip.id]: event.target.value,
                          }))}
                          placeholder="Tempel token verifikasi"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={128}
                        />
                        {scannerTripId === trip.id ? (
                          <button className="driver-scan-action" onClick={stopScanner}>
                            <X size={16} />
                            Tutup kamera
                          </button>
                        ) : (
                          <button
                            className="driver-scan-action"
                            onClick={() => openScanner(trip.id)}
                            disabled={busy}
                          >
                            <Camera size={16} />
                            Pindai QR
                          </button>
                        )}
                        <button
                          className="driver-primary-action"
                          onClick={() => void handleVerify(trip)}
                          disabled={busy || !isOnline}
                        >
                          <ShieldCheck size={16} />
                          {busy ? "Memeriksa..." : "Verifikasi tiba"}
                        </button>
                      </div>

                      {scannerTripId === trip.id && (
                        <div className="driver-scanner">
                          <div className="driver-scanner-frame">
                            <video ref={scanVideoRef} muted playsInline aria-label="Pratinjau kamera QR" />
                            {scannerState !== "scanning" && (
                              <div className="driver-scanner-overlay">
                                {scannerState === "starting" ? (
                                  <>
                                    <span className="driver-scanner-spinner" />
                                    <strong>Menyiapkan kamera...</strong>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle size={18} />
                                    <strong>Kamera tidak aktif</strong>
                                  </>
                                )}
                              </div>
                            )}
                            {scannerState === "scanning" && <span className="driver-scanner-guide" />}
                          </div>
                          <div className="driver-scanner-copy">
                            {scannerState === "scanning" ? (
                              <small>Arahkan kamera ke QR tiket. Setelah terbaca, tekan Verifikasi tiba.</small>
                            ) : scannerError ? (
                              <small className="driver-scanner-error">{scannerError}</small>
                            ) : (
                              <small>Menyiapkan kamera belakang...</small>
                            )}
                          </div>
                        </div>
                      )}

                      <small>Verifikasi membutuhkan lokasi GPS di dalam area tujuan.</small>
                    </div>
                  )}

                  {trip.status === "ARRIVAL_VERIFIED" && (
                    <button
                      className="driver-primary-action"
                      onClick={() => void handleStartDelivery(trip)}
                      disabled={busy || !isOnline}
                    >
                      <PackageCheck size={16} />
                      {busy ? "Memproses..." : "Mulai serah-terima"}
                    </button>
                  )}

                  {trip.status === "DELIVERY_IN_PROGRESS" && podTripId !== trip.id && (
                    <button className="driver-primary-action" onClick={() => openPod(trip)}>
                      <FileCheck2 size={16} />
                      Isi POD
                    </button>
                  )}

                  {trip.status === "DELIVERED" && proofTripId !== trip.id && (
                    <button className="driver-secondary-action" onClick={() => setProofTripId(trip.id)}>
                      <Camera size={16} />
                      Unggah bukti POD
                    </button>
                  )}

                  <Link className="driver-detail-link" href={`/trips/${trip.id}`}>
                    Detail perjalanan
                    <ArrowRight size={14} />
                  </Link>
                </div>

                {podTripId === trip.id && (
                  <div className="driver-inline-panel">
                    <div className="driver-inline-head">
                      <div>
                        <strong>Rekonsiliasi POD</strong>
                        <span>Dikirim {dispatched} porsi. Isi jumlah yang benar-benar diterima.</span>
                      </div>
                      <button onClick={() => setPodTripId(null)} aria-label="Tutup form POD">
                        <X size={15} />
                      </button>
                    </div>
                    <div className="driver-field-grid">
                      <label>
                        Diterima
                        <input
                          type="number"
                          min={0}
                          max={dispatched}
                          step={1}
                          inputMode="numeric"
                          value={podReceived}
                          onChange={(event) => setPodReceived(event.target.value)}
                        />
                      </label>
                      <label>
                        Rusak
                        <input
                          type="number"
                          min={0}
                          max={dispatched}
                          step={1}
                          inputMode="numeric"
                          value={podDamaged}
                          onChange={(event) => setPodDamaged(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className={hasPodVariance ? "driver-variance driver-variance-active" : "driver-variance"}>
                      <span>Selisih</span>
                      <strong>{Number.isFinite(podShortage) ? Math.max(0, podShortage) : 0} porsi</strong>
                      <small>
                        {hasPodVariance
                          ? "Alasan selisih wajib diisi dan akan direview admin."
                          : "Tidak ada selisih. POD langsung diterima."}
                      </small>
                    </div>
                    {hasPodVariance && (
                      <label className="driver-field-full">
                        Alasan selisih
                        <textarea
                          value={podReason}
                          onChange={(event) => setPodReason(event.target.value)}
                          placeholder="Contoh: 4 porsi rusak saat bongkar muat"
                          rows={3}
                          maxLength={2000}
                        />
                      </label>
                    )}
                    <label className="driver-field-full">
                      Catatan penerimaan (opsional)
                      <textarea
                        value={podNote}
                        onChange={(event) => setPodNote(event.target.value)}
                        placeholder="Nama penerima, kondisi kemasan, atau catatan lain"
                        rows={2}
                        maxLength={2000}
                      />
                    </label>
                    <div className="driver-form-actions">
                      <button className="driver-secondary-action" onClick={() => setPodTripId(null)}>
                        Batal
                      </button>
                      <button
                        className="driver-primary-action"
                        onClick={() => void handleSubmitPod(trip)}
                        disabled={busy || !isOnline}
                      >
                        <FileCheck2 size={16} />
                        {busy ? "Menyimpan..." : "Kirim POD"}
                      </button>
                    </div>
                  </div>
                )}

                {proofTripId === trip.id && (
                  <div className="driver-inline-panel">
                    <div className="driver-inline-head">
                      <div>
                        <strong>Bukti POD</strong>
                        <span>Unggah foto atau PDF. Maksimal 10 MB.</span>
                      </div>
                      <button onClick={() => setProofTripId(null)} aria-label="Tutup unggah bukti">
                        <X size={15} />
                      </button>
                    </div>
                    <input
                      key={`${trip.id}-${proofInputKey}`}
                      className="driver-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                    />
                    <div className="driver-form-actions">
                      <button className="driver-secondary-action" onClick={() => setProofTripId(null)}>
                        Batal
                      </button>
                      <button
                        className="driver-primary-action"
                        onClick={() => void handleUploadProof(trip)}
                        disabled={busy || !proofFile || !isOnline}
                      >
                        <Upload size={16} />
                        {busy ? "Mengunggah..." : "Unggah bukti"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="driver-footer">
          <span><span className="footer-dot" /> RADAR MBG - Driver Console</span>
          <span>GPS dikirim maksimal tiap 15 detik selama perjalanan</span>
        </footer>
      </div>
    </main>
  );
}
