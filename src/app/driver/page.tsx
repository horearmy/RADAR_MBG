"use client";

import { useEffect, useRef, useState } from "react";
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
  LogOut,
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
  apiBaseUrl,
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

const activeStatuses = new Set([
  "READY_TO_DEPART",
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
  "DELIVERED",
]);

export default function DriverPage() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tab, setTab] = useState<DriverTab>("active");
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [podTripId, setPodTripId] = useState<string | null>(null);
  const [podReceived, setPodReceived] = useState("");
  const [podDamaged, setPodDamaged] = useState("0");
  const [podReason, setPodReason] = useState("");
  const [podNote, setPodNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingPod, setSubmittingPod] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoadState("checking");
      let user: SessionUser;
      try {
        user = await getCurrentSession();
      } catch (sessionError: unknown) {
        if (!active) return;
        if (sessionError instanceof Error && (sessionError.message === "UNAUTHENTICATED" || sessionError.message === "REQUEST_FAILED_403")) {
          router.replace("/driver/login?expired=1");
          return;
        }
        setLoadState("unavailable");
        setError(sessionError instanceof Error ? sessionError.message : "Unknown error");
        return;
      }
      if (!active) return;
      setSessionUser(user);

      const canDrive = hasPermission(user, "trip:start") && hasPermission(user, "trip:location:update");
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
        if (tripError instanceof Error && (tripError.message === "UNAUTHENTICATED" || tripError.message === "REQUEST_FAILED_403")) {
          router.replace("/driver/login?expired=1");
          return;
        }
        setLoadState("error");
        setError(tripError instanceof Error ? tripError.message : "Unknown error");
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  if (loadState === "checking") {
    return <main className="session-state"><span className="session-spinner" /><p>Memuat data operasional…</p></main>;
  }

  if (loadState === "unavailable") {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>{error || "Dashboard tidak dapat memverifikasi sesi."}</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  if (loadState === "forbidden") {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>Peran Anda tidak memiliki izin driver.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  if (loadState === "error") {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>{error}</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  const activeTrips = trips.filter((t) => activeStatuses.has(t.status));
  const historyTrips = trips.filter((t) => !activeStatuses.has(t.status));

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
          <span className="trip-user-avatar">{sessionUser?.displayName?.slice(0, 2).toUpperCase() ?? "??"}</span>
          <span>
            <strong>{sessionUser?.displayName ?? "Driver"}</strong>
            <small>{sessionUser ? getSessionRole(sessionUser) : ""}</small>
          </span>
          <button
            type="button"
            className="driver-logout-btn"
            onClick={async () => {
              try {
                const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
                const { csrfToken } = await csrfRes.json();
                await fetch(`${apiBaseUrl}/auth/logout`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "x-csrf-token": csrfToken },
                });
              } finally {
                router.replace("/driver/login");
              }
            }}
            aria-label="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="driver-content">
        <section className="driver-hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              DRIVER CONSOLE
            </div>
            <h1>Selamat datang, {sessionUser?.displayName?.split(" ")[0]}</h1>
            <p>{activeTrips.length} tugas aktif · {historyTrips.length} riwayat</p>
          </div>
        </section>

        <div className="driver-tabs">
          <button type="button" className={`driver-tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
            Tugas Aktif <span>{activeTrips.length}</span>
          </button>
          <button type="button" className={`driver-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            Riwayat <span>{historyTrips.length}</span>
          </button>
        </div>

        <div className="driver-trip-list">
          {(tab === "active" ? activeTrips : historyTrips).map((trip) => (
            <div key={trip.id} className="driver-trip-card">
              <div className="driver-trip-header">
                <span className="trip-id">TRP-{trip.id.slice(0, 8).toUpperCase()}</span>
                <span className="status-pill">{trip.status}</span>
              </div>
              <div className="driver-trip-route">
                <strong>{trip.sppg?.name ?? "—"} → {trip.deliveryLocation?.name ?? "—"}</strong>
                <small>{trip.vehicle?.plateNumber ?? "—"} · {trip.driver?.name ?? "—"}</small>
              </div>
              <div className="driver-trip-meta">
                <span>ETA: {trip.plannedArrivalAt ? new Date(trip.plannedArrivalAt).toLocaleTimeString("id-ID") : "—"}</span>
                <span>{trip.plannedQuantity} porsi</span>
              </div>
              {activeStatuses.has(trip.status) && (
                <div className="driver-trip-actions">
                  <button type="button" className="session-retry" onClick={() => setPodTripId(trip.id)}>
                    Bukti Pengiriman (POD)
                  </button>
                </div>
              )}
            </div>
          ))}
          {!(tab === "active" ? activeTrips : historyTrips).length && (
            <p className="table-empty">Belum ada perjalanan pada filter ini.</p>
          )}
        </div>
      </div>

      {podTripId && (
        <div className="pod-modal">
          <div className="pod-modal-content">
            <h2>Bukti Pengiriman (POD)</h2>
            <p>Trip: TRP-{podTripId.slice(0, 8).toUpperCase()}</p>
            <div>
              <label>Barang diterima (porsi):</label>
              <input type="number" value={podReceived} onChange={(e) => setPodReceived(e.target.value)} />
            </div>
            <div>
              <label>Barang rusak (porsi):</label>
              <input type="number" value={podDamaged} onChange={(e) => setPodDamaged(e.target.value)} />
            </div>
            {Number(podDamaged) > 0 && (
              <div>
                <label>Alasan rusak:</label>
                <input type="text" value={podReason} onChange={(e) => setPodReason(e.target.value)} />
              </div>
            )}
            <div>
              <label>Catatan:</label>
              <textarea value={podNote} onChange={(e) => setPodNote(e.target.value)} />
            </div>
            <div>
              <label>Foto bukti:</label>
              <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="pod-modal-actions">
              <button type="button" onClick={() => setPodTripId(null)}>Batal</button>
              <button type="button" disabled={submittingPod} onClick={async () => {
                setSubmittingPod(true);
                try {
                  await submitTripDelivery(podTripId, {
                    receivedQuantity: Number(podReceived) || 0,
                    damagedQuantity: Number(podDamaged) || 0,
                    varianceReason: podReason || undefined,
                    confirmationNote: podNote || undefined,
                  });
                  if (proofFile) {
                    await uploadTripProof(podTripId, proofFile);
                  }
                  setPodTripId(null);
                  setPodReceived("");
                  setPodDamaged("0");
                  setPodReason("");
                  setPodNote("");
                  setProofFile(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Gagal kirim POD");
                } finally {
                  setSubmittingPod(false);
                }
              }}>
                {submittingPod ? "Mengirim..." : "Kirim POD"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}