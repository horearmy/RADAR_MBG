"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navigation } from "lucide-react";
import {
  completeTrip,
  getSelectedTenantId,
  getTripDetail,
  getTrips,
  setSelectedTenantId,
  startTrip,
  startTripDelivery,
  type SessionUser,
  type TripDetail,
  type TripSummary,
} from "@/lib/api";
import { clearFieldCaches, logoutField, resolveWorkspaces } from "@/lib/field-api";
import {
  DRIVER_ACTIVE_STATUSES,
  TRACKING_STATUSES,
  formatDateTime,
  formatTime,
  safeErrorMessage,
  tripReference,
} from "@/lib/field-status";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useTripTracking } from "@/lib/use-trip-tracking";
import {
  Banner,
  BottomNavigation,
  ConfirmActionSheet,
  EmptyState,
  ErrorState,
  FieldAppHeader,
  FieldDialog,
  GpsTrackingIndicator,
  LoadingSkeleton,
  LocationPermissionBanner,
  OfflineSyncBanner,
  StatusBadge,
  type NavItem,
} from "@/components/field-ui";
import { PodForm } from "./driver-pod-form";
import { DriverNavigation } from "@/components/driver-navigation";
import { DevTools } from "@/components/dev-tools";

type LoadState = "loading" | "ready" | "forbidden" | "error";
type Tab = "home" | "tasks" | "history" | "profile" | "navigasi";
type TaskFilter = "today" | "upcoming" | "done";
type ConfirmKind = "start" | "delivery" | "complete";

const TABS: Tab[] = ["home", "tasks", "history", "profile", "navigasi"];
const HISTORY_PAGE = 10;
const jakartaDay = (value: string | number | Date) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

function primaryActionLabel(status: string, canComplete: boolean): string | null {
  switch (status) {
    case "READY_TO_DEPART":
      return "Mulai Perjalanan";
    case "IN_TRANSIT":
      return "Lanjutkan Perjalanan";
    case "ARRIVAL_VERIFIED":
      return "Mulai Serah Terima";
    case "DELIVERY_IN_PROGRESS":
      return "Buat POD";
    case "DELIVERED":
      return canComplete ? "Selesaikan Perjalanan" : null;
    default:
      return null;
  }
}

export default function DriverClient() {
  const router = useRouter();

  const sessionExpired = useCallback(() => {
    clearFieldCaches();
    router.replace("/radarapp/login?expired=1");
  }, [router]);

  const showNotice = useCallback((tone: "success" | "danger" | "warning", text: string) => {
    setNotice({ tone, text });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  }, []);
  const searchParams = useSearchParams();
  const online = useOnlineStatus();
  const rawTab = searchParams.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "home";

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("today");
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; trip: TripSummary } | null>(null);
  const [podTripId, setPodTripId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const detailRequestIdRef = useRef(0);
  const tripsRequestIdRef = useRef(0);

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  // DevTools: dengar event "preview-pod" untuk buka form POD langsung (development only).
  useEffect(() => {
    function handlePreviewPod(event: Event) {
      const detail = (event as CustomEvent<{ tripId?: string }>).detail;
      if (detail?.tripId) {
        setPodTripId(detail.tripId);
      }
    }
    window.addEventListener("devtools:preview-pod", handlePreviewPod);
    return () => window.removeEventListener("devtools:preview-pod", handlePreviewPod);
  }, []);

  const loadTrips = useCallback(
    async (initial: boolean) => {
      const requestId = ++tripsRequestIdRef.current;
      try {
        if (initial) {
          const resolved = await resolveWorkspaces({ skipRecipientProbeForDriver: true });
          if (!resolved.workspaces.includes("driver")) {
            if (resolved.workspaces.includes("recipient")) {
              router.replace("/radarapp/recipient");
              return;
            }
            setUser(resolved.user);
            setLoadState("forbidden");
            return;
          }
          setUser(resolved.user);
          if (!getSelectedTenantId() && (resolved.user.tenantMemberships?.length ?? 0) === 1) {
            setSelectedTenantId(resolved.user.tenantMemberships![0].tenantId);
          }
        }
        const result = await getTrips({ page: 1, pageSize: 100 });
        if (requestId !== tripsRequestIdRef.current) return;
        setTrips(result.data);
        setLastSync(Date.now());
        setRefreshError(false);
        setLoadState("ready");
      } catch (error) {
        if (requestId !== tripsRequestIdRef.current) return;
        const message = error instanceof Error ? error.message : "";
        if (message === "UNAUTHENTICATED" || message === "REQUEST_FAILED_403") {
          sessionExpired();
          return;
        }
        if (initial) {
          setErrorText(safeErrorMessage(error));
          setLoadState("error");
        } else {
          setRefreshError(true);
        }
      }
    },
    [router, sessionExpired],
  );

  useEffect(() => {
    void loadTrips(true);
    const interval = window.setInterval(() => void loadTrips(false), 45_000);
    return () => window.clearInterval(interval);
  }, [loadTrips]);

  const trackedTrip = useMemo(
    () => trips.find((t) => TRACKING_STATUSES.has(t.status)) ?? null,
    [trips],
  );
  const tracker = useTripTracking({
    userId: user?.id ?? null,
    tripId: trackedTrip?.id ?? null,
    active: Boolean(trackedTrip),
    onUnauthenticated: sessionExpired,
  });

  const today = jakartaDay(new Date());
  const byDeparture = (a: TripSummary, b: TripSummary) =>
    new Date(a.plannedDepartureAt).getTime() - new Date(b.plannedDepartureAt).getTime();
  const activeTrips = useMemo(
    () => trips.filter((t) => DRIVER_ACTIVE_STATUSES.has(t.status)).sort(byDeparture),
    [trips],
  );
  const doneTrips = useMemo(
    () =>
      trips
        .filter((t) => !DRIVER_ACTIVE_STATUSES.has(t.status))
        .sort((a, b) => byDeparture(b, a)),
    [trips],
  );
  const currentTrip = trackedTrip ?? activeTrips[0] ?? null;
  const todayTrips = trips.filter((t) => jakartaDay(t.plannedDepartureAt) === today);
  const todayDone = todayTrips.filter((t) => t.status === "COMPLETED").length;
  const todayRemaining = todayTrips.filter((t) => DRIVER_ACTIVE_STATUSES.has(t.status)).length;

  // Current GPS position for navigation
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [navigatingTripId, setNavigatingTripId] = useState<string | null>(null);

  const navigationTrip = useMemo(
    () => (navigatingTripId ? trips.find((t) => t.id === navigatingTripId) ?? null : currentTrip),
    [navigatingTripId, trips, currentTrip],
  );

  const navigationDestination = useMemo(
    () =>
      navigationTrip?.deliveryLocation.latitude && navigationTrip?.deliveryLocation.longitude
        ? {
            latitude: Number(navigationTrip.deliveryLocation.latitude),
            longitude: Number(navigationTrip.deliveryLocation.longitude),
            name: navigationTrip.deliveryLocation.name ?? "Lokasi Tujuan",
          }
        : null,
    [navigationTrip],
  );

  const navItems: NavItem[] = [
    { key: "home", label: "Beranda", href: "/radarapp/driver?tab=home" },
    { key: "tasks", label: "Tugas", href: "/radarapp/driver?tab=tasks" },
    { key: "history", label: "Riwayat", href: "/radarapp/driver?tab=history" },
    { key: "navigasi", label: "Navigasi", href: "/radarapp/driver?tab=navigasi", badge: navigatingTripId ? 1 : undefined },
    { key: "profile", label: "Profil", href: "/radarapp/driver?tab=profile" },
  ];

  // Track GPS position when navigating
  useEffect(() => {
    if (!navigatingTripId) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [navigatingTripId]);

  function startNavigation(trip: TripSummary) {
    if (!trip.deliveryLocation.latitude || !trip.deliveryLocation.longitude) return;
    setNavigatingTripId(trip.id);
    setCurrentPosition(null);
    // Switch to navigation tab
    router.push("/radarapp/driver?tab=navigasi");
  }

  const loadDetail = useCallback(
    async (id: string) => {
      const requestId = ++detailRequestIdRef.current;
      setDetailState("loading");
      try {
        const result = await getTripDetail(id);
        if (requestId !== detailRequestIdRef.current) return;
        setDetail(result);
        setDetailState("idle");
      } catch (error) {
        if (requestId !== detailRequestIdRef.current) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          sessionExpired();
          return;
        }
        setDetailState("error");
      }
    },
    [sessionExpired],
  );

  function openDetail(trip: TripSummary) {
    setDetail(null);
    setDetailId(trip.id);
    void loadDetail(trip.id);
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailState("idle");
  }

  const podTrip = podTripId ? trips.find((t) => t.id === podTripId) ?? null : null;
  const detailTrip = detailId ? trips.find((t) => t.id === detailId) ?? null : null;
  const record = detail?.deliveryRecords?.[0] ?? null;
  const canComplete =
    detail?.id === detailTrip?.id &&
    detailTrip?.status === "DELIVERED" &&
    record?.reviewStatus === "ACCEPTED" &&
    detailTrip.deliveryStatus !== "UNDER_REVIEW";
  const podRejected = detailTrip?.status === "DELIVERED" && record?.reviewStatus === "REJECTED";

  function runPrimary(trip: TripSummary) {
    switch (trip.status) {
      case "READY_TO_DEPART":
        setConfirm({ kind: "start", trip });
        break;
      case "IN_TRANSIT":
        setDetail(null);
        setDetailId(trip.id);
        void loadDetail(trip.id);
        break;
      case "ARRIVAL_VERIFIED":
        setConfirm({ kind: "delivery", trip });
        break;
      case "DELIVERY_IN_PROGRESS":
        openPod(trip);
        break;
      case "DELIVERED":
        openDetail(trip);
        break;
      default:
        openDetail(trip);
    }
  }

  function openPod(trip: TripSummary) {
    if (detailId !== trip.id || !detail) {
      setDetail(null);
      void loadDetail(trip.id);
    }
    setPodTripId(trip.id);
  }

  async function executeConfirm() {
    if (!confirm || busy) return;
    const { kind, trip } = confirm;
    setBusy(true);
    try {
      if (kind === "start") {
        const fix = await tracker.requestPermission();
        if (!fix) {
          showNotice("danger", "Lokasi perangkat belum tersedia. Aktifkan GPS, izinkan akses lokasi, lalu coba lagi. Perjalanan baru dapat dimulai dari area SPPG.");
          return;
        }
        await startTrip(trip.id, {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracyMeters: fix.accuracyMeters,
          deviceTimestamp: fix.deviceTimestamp,
        });
        showNotice("success", "Perjalanan dimulai. Pelacakan lokasi aktif.");
      } else if (kind === "delivery") {
        await startTripDelivery(trip.id);
        showNotice("success", "Serah terima dimulai. Anda dapat membuat POD.");
      } else {
        await completeTrip(trip.id);
        showNotice("success", "Perjalanan diselesaikan. Pelacakan lokasi dihentikan.");
      }
      setConfirm(null);
      await loadTrips(false);
      if (detailId === trip.id) void loadDetail(trip.id);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        sessionExpired();
        return;
      }
      showNotice("danger", safeErrorMessage(error));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await logoutField();
    router.replace("/radarapp/login");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loadState === "loading") {
    return (
      <main className="field-app">
        <FieldAppHeader title="RADAR MBG" subtitle="Driver" />
        <div className="field-content">
          <LoadingSkeleton />
        </div>
      </main>
    );
  }

  if (loadState === "forbidden") {
    return (
      <main className="field-app">
        <FieldAppHeader title="RADAR MBG" subtitle="Driver" name={user?.displayName} onLogout={() => void doLogout()} />
        <div className="field-content">
          <ErrorState
            title="Akses terbatas"
            message="Akun Anda tidak memiliki akses Driver atau Penerima. Hubungi administrator SPPG atau pengelola lokasi."
          />
        </div>
      </main>
    );
  }

  const taskList = (() => {
    if (taskFilter === "done") return doneTrips;
    if (taskFilter === "upcoming") return activeTrips.filter((t) => jakartaDay(t.plannedDepartureAt) > today && !TRACKING_STATUSES.has(t.status));
    return activeTrips.filter((t) => jakartaDay(t.plannedDepartureAt) <= today || TRACKING_STATUSES.has(t.status));
  })();

  const renderTripCard = (trip: TripSummary) => {
    const label = primaryActionLabel(trip.status, false);
    const actionable = label !== null && trip.status !== "DELIVERED";
    const canPod = trip.status === "DELIVERY_IN_PROGRESS";
    const showPrimary = actionable && !canPod;
    return (
      <article key={trip.id} className="field-card field-stack" aria-label={`Perjalanan ${tripReference(trip.id)}`}>
        <div className="field-trip-head">
          <span className="field-trip-ref">{tripReference(trip.id)}</span>
          <StatusBadge status={trip.status} />
        </div>
        <div className="field-meta">
          <strong>{trip.deliveryLocation.name}</strong>
          <span>{trip.sppg.name}</span>
          <span>
            Kendaraan {trip.vehicle.plateNumber} · {trip.plannedQuantity} porsi
          </span>
          <span>
            Jadwal {formatDateTime(trip.plannedDepartureAt)} · Tiba {formatTime(trip.plannedArrivalAt)}
          </span>
        </div>
        {trip.status === "SCHEDULED" && <span className="field-hint">Menunggu dispatcher menandai siap berangkat.</span>}
        {trip.status === "ARRIVAL_DETECTED" && (
          <span className="field-hint">Kendaraan terdeteksi memasuki area. Verifikasi kedatangan dilakukan dengan QR di Konsol Driver.</span>
        )}
        <div className="field-actions">
          <button type="button" className="field-btn" onClick={() => openDetail(trip)}>
            Lihat Detail
          </button>
          {trip.deliveryLocation.latitude && trip.deliveryLocation.longitude && (
            <button type="button" className="field-btn" onClick={() => startNavigation(trip)}>
              <Navigation size={16} aria-hidden="true" /> Navigasi
            </button>
          )}
          <button
            type="button"
            className="field-btn"
            data-variant={canPod ? "primary" : undefined}
            onClick={() => canPod && runPrimary(trip)}
            disabled={!canPod}
            title={canPod ? "Buat POD" : "POD tersedia saat status Serah Terima Berjalan"}
          >
            Buat POD
          </button>
          {showPrimary && (
            <button type="button" className="field-btn" data-variant="primary" onClick={() => runPrimary(trip)}>
              {label}
            </button>
          )}
        </div>
      </article>
    );
  };

  const profileSection = (
    <section className="field-card field-stack">
      <h2 className="field-section-title">Profil</h2>
      <dl className="field-dl">
        <div>
          <dt>Nama</dt>
          <dd>{user?.displayName ?? "-"}</dd>
        </div>
        <div>
          <dt>Akun</dt>
          <dd>{user?.username ?? "-"}</dd>
        </div>
        <div>
          <dt>Peran</dt>
          <dd>Driver</dd>
        </div>
        <div>
          <dt>SPPG</dt>
          <dd>{trips[0]?.sppg.name ?? "-"}</dd>
        </div>
        <div>
          <dt>Izin lokasi</dt>
          <dd>
            {{ granted: "Diberikan", denied: "Ditolak", revoked: "Dicabut", prompt: "Belum diminta", unsupported: "Tidak didukung", unknown: "Memeriksa..." }[tracker.permission]}
          </dd>
        </div>
      </dl>
      <LocationPermissionBanner permission={tracker.permission} />
      <button type="button" className="field-btn field-btn-block" onClick={() => void doLogout()}>
        Keluar
      </button>
    </section>
  );

  return (
    <main className="field-app">
      <FieldAppHeader title="RADAR MBG" subtitle="Driver" name={user?.displayName} onLogout={() => void doLogout()} />
      <div className="field-content">
        <OfflineSyncBanner online={online} lastSync={lastSync} pending={tracker.pending} />
        {loadState === "error" ? (
          <ErrorState message={errorText} onRetry={() => { setLoadState("loading"); void loadTrips(true); }} />
        ) : null}

        {refreshError && online && (
          <Banner tone="warning" title="Pembaruan gagal">
            Data di layar mungkin tidak terbaru. Terakhir sinkron {lastSync ? formatDateTime(lastSync) : "-"}.
          </Banner>
        )}

        {tab === "home" && (
          <>
            <section className="field-section" aria-label="Ringkasan hari ini">
              <h2 className="field-section-title">Halo, {user?.displayName?.split(" ")[0] ?? "Driver"}</h2>
              <div className="field-stats-grid">
                <div className="field-stat">
                  <strong>{todayTrips.length}</strong>
                  <span>Stop hari ini</span>
                </div>
                <div className="field-stat">
                  <strong>{todayDone}</strong>
                  <span>Selesai</span>
                </div>
                <div className="field-stat">
                  <strong>{todayRemaining}</strong>
                  <span>Tersisa</span>
                </div>
              </div>
            </section>

            <section className="field-section" aria-label="Tugas aktif">
              <h2 className="field-section-title">Tugas aktif</h2>
              {currentTrip ? (
                <>
                  {renderTripCard(currentTrip)}
                  <p className="field-caption" style={{ margin: 0 }}>
                    Kendaraan ditugaskan: <strong>{currentTrip.vehicle.plateNumber}</strong>
                  </p>
                </>
              ) : (
                <EmptyState
                  title="Belum ada perjalanan yang ditugaskan."
                  description="Tugas baru akan muncul setelah dispatcher menugaskan Anda."
                />
              )}
              {doneTrips.length > 0 && (
                <>
                  <h2 className="field-section-title">Riwayat terakhir</h2>
                  <div className="field-list">
                    {doneTrips.slice(0, 3).map(renderTripCard)}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {tab === "tasks" && (
          <>
            <h1 className="field-page-title">Tugas</h1>
            <div className="field-tabs" role="group" aria-label="Filter tugas">
              {([["today", "Hari Ini"], ["upcoming", "Mendatang"], ["done", "Selesai"]] as Array<[TaskFilter, string]>).map(([key, label]) => (
                <button key={key} type="button" className="field-chip" aria-pressed={taskFilter === key} onClick={() => setTaskFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
            {taskList.length === 0 ? (
              <EmptyState title="Belum ada perjalanan yang ditugaskan." description="Tidak ada tugas pada filter ini." />
            ) : (
              <div className="field-list">
                {taskList.map(renderTripCard)}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            <h1 className="field-page-title">Riwayat</h1>
            {doneTrips.length === 0 ? (
              <EmptyState title="Belum ada riwayat perjalanan." />
            ) : (
              <>
                <div className="field-list">
                  {doneTrips.slice(0, historyLimit).map(renderTripCard)}
                </div>
                {doneTrips.length > historyLimit && (
                  <button type="button" className="field-btn field-btn-block" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}>
                    Muat lebih banyak
                  </button>
                )}
              </>
            )}
          </>
        )}

        <div
          className="field-section"
          style={{ display: tab === "navigasi" ? "block" : "none" }}
          aria-hidden={tab !== "navigasi"}
        >
          <h1 className="field-page-title">Navigasi</h1>
          {!navigationTrip ? (
            <EmptyState
              title="Belum ada perjalanan aktif"
              description="Pilih perjalanan dari menu Beranda atau Tugas untuk memulai navigasi."
            />
          ) : !navigationDestination ? (
            <EmptyState
              title="Lokasi tujuan tidak tersedia"
              description="Perjalanan ini tidak memiliki koordinat lokasi tujuan."
            />
          ) : (
            <DriverNavigation
              origin={currentPosition}
              destination={navigationDestination}
              onStartLiveGps={() => setNavigatingTripId(navigationTrip.id)}
              liveGpsActive={Boolean(navigatingTripId) && Boolean(currentPosition)}
              visible={tab === "navigasi"}
            />
          )}
        </div>

        {tab === "profile" && profileSection}
      </div>

      {notice && (
        <div className="field-toast">
          <Banner tone={notice.tone}>{notice.text}</Banner>
        </div>
      )}

      <BottomNavigation items={navItems} current={tab} label="Navigasi driver" />

      {/* DevTools (development only) */}
      <DevTools onStatusChanged={() => void loadTrips(false)} />

      {/* Detail perjalanan */}
      {detailTrip && !podTripId && !confirm && (
        <FieldDialog labelledBy="trip-detail-title" onClose={closeDetail}>
          <>
            <div className="field-trip-head">
              <h2 id="trip-detail-title">{tripReference(detailTrip.id)}</h2>
              <StatusBadge status={detailTrip.status} />
            </div>
            {detailState === "loading" && <LoadingSkeleton count={2} />}
            {detailState === "error" && (
              <ErrorState message="Detail perjalanan tidak dapat dimuat." onRetry={() => void loadDetail(detailTrip.id)} />
            )}
            <dl className="field-dl" style={{ marginTop: 10 }}>
              <div><dt>SPPG asal</dt><dd>{detailTrip.sppg.name}</dd></div>
              <div><dt>Kendaraan</dt><dd>{detailTrip.vehicle.plateNumber}</dd></div>
              <div><dt>Jadwal berangkat</dt><dd>{formatDateTime(detailTrip.plannedDepartureAt)}</dd></div>
              <div><dt>Jadwal tiba</dt><dd>{formatDateTime(detailTrip.plannedArrivalAt)}</dd></div>
              <div><dt>Rencana</dt><dd>{detailTrip.plannedQuantity} porsi</dd></div>
              <div>
                <dt>ETA</dt>
                <dd>Belum tersedia dari layanan</dd>
              </div>
            </dl>

            <h3 className="field-section-title" style={{ margin: "14px 0 8px" }}>Stop</h3>
            <ol className="field-timeline">
              <li data-state={detailTrip.status === "COMPLETED" ? "done" : "current"}>
                <span className="field-timeline-dot" aria-hidden="true">1</span>
                <div className="field-meta">
                  <strong>{detailTrip.deliveryLocation.name}</strong>
                  {detail?.deliveryLocation.address && <span>{detail.deliveryLocation.address}</span>}
                  <span>
                    Geofence:{" "}
                    {detailTrip.status === "ARRIVAL_DETECTED"
                      ? "Kendaraan terdeteksi memasuki area (menunggu verifikasi)"
                      : ["ARRIVAL_VERIFIED", "DELIVERY_IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(detailTrip.status)
                        ? `Kendaraan tiba di area${detail?.arrivalVerifiedAt ? ` · terverifikasi ${formatDateTime(detail.arrivalVerifiedAt)}` : ""}`
                        : "Belum memasuki area"}
                  </span>
                  <span>
                    POD:{" "}
                    {record
                      ? record.reviewStatus === "PENDING_REVIEW"
                        ? "POD terkirim · menunggu verifikasi"
                        : record.reviewStatus === "ACCEPTED"
                          ? "Diterima"
                          : "Ditolak · perlu diperbaiki"
                      : "Belum dibuat"}
                  </span>
                  {record?.reviewStatus === "REJECTED" && record.reviewReason && <span>Alasan: {record.reviewReason}</span>}
                </div>
              </li>
            </ol>

            {detailTrip.status === "ARRIVAL_DETECTED" && (
              <Banner tone="info">Verifikasi kedatangan dengan QR dilakukan di Konsol Driver (menu Driver pada platform).</Banner>
            )}
            {detailTrip.status === "IN_TRANSIT" && (
              <div style={{ margin: "10px 0" }}>
                <GpsTrackingIndicator
                  tracking={tracker.tracking}
                  stale={tracker.stale}
                  poorAccuracy={tracker.poorAccuracy}
                  accuracy={tracker.accuracy}
                  lastSentAt={tracker.lastSentAt}
                  lastFixAt={tracker.lastFixAt}
                  online={online}
                  pending={tracker.pending}
                  watchError={tracker.watchError}
                />
                <LocationPermissionBanner permission={tracker.permission} />
              </div>
            )}

            <div className="field-actions" style={{ marginTop: 14 }}>
              <button type="button" className="field-btn" onClick={closeDetail}>
                Tutup
              </button>
              {["IN_TRANSIT", "ARRIVAL_DETECTED", "ARRIVAL_VERIFIED"].includes(detailTrip.status) && (
                <a
                  className="field-btn"
                  href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(
                    [detailTrip.deliveryLocation.name, detail?.deliveryLocation.address].filter(Boolean).join(", "),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation size={16} aria-hidden="true" /> Buka Navigasi
                </a>
              )}
              {detailTrip.status === "READY_TO_DEPART" && (
                <button type="button" className="field-btn" data-variant="primary" onClick={() => setConfirm({ kind: "start", trip: detailTrip })}>
                  Mulai Perjalanan
                </button>
              )}
              {detailTrip.status === "ARRIVAL_VERIFIED" && (
                <button type="button" className="field-btn" data-variant="primary" onClick={() => setConfirm({ kind: "delivery", trip: detailTrip })}>
                  Mulai Serah Terima
                </button>
              )}
              {(detailTrip.status === "DELIVERY_IN_PROGRESS" || podRejected) && (
                <button type="button" className="field-btn" data-variant="primary" onClick={() => openPod(detailTrip)}>
                  {podRejected ? "Perbaiki POD" : "Buat POD"}
                </button>
              )}
              {canComplete && (
                <button type="button" className="field-btn" data-variant="primary" onClick={() => setConfirm({ kind: "complete", trip: detailTrip })}>
                  Selesaikan Perjalanan
                </button>
              )}
            </div>
          </>
        </FieldDialog>
      )}

      {/* Konfirmasi tindakan */}
      {confirm && (
        <ConfirmActionSheet
          title={
            confirm.kind === "start" ? "Mulai perjalanan?" : confirm.kind === "delivery" ? "Mulai serah terima?" : "Selesaikan perjalanan?"
          }
          description={
            confirm.kind === "start"
              ? "GPS wajib aktif dan kendaraan harus berada di area SPPG. Lokasi akan dikirim selama perjalanan aktif untuk memantau kendaraan dan mendeteksi kedatangan. Pelacakan berhenti saat perjalanan selesai atau dibatalkan. Tindakan ini tercatat."
              : confirm.kind === "delivery"
                ? "Pastikan kendaraan sudah tiba di lokasi penerima. Setelah ini Anda dapat membuat POD. Tindakan ini tercatat."
                : "Perjalanan akan ditutup dan pelacakan lokasi dihentikan. Tindakan ini tercatat dan tidak dapat dibatalkan."
          }
          confirmLabel={confirm.kind === "start" ? "Mulai Perjalanan" : confirm.kind === "delivery" ? "Mulai Serah Terima" : "Selesaikan"}
          busy={busy}
          onConfirm={() => void executeConfirm()}
          onClose={() => setConfirm(null)}
        >
          <p className="field-caption" style={{ margin: 0 }}>
            {tripReference(confirm.trip.id)} · {confirm.trip.deliveryLocation.name}
          </p>
        </ConfirmActionSheet>
      )}

      {/* Form POD */}
      {podTrip && (
        <FieldDialog labelledBy="pod-title" onClose={() => setPodTripId(null)} dismissable={false}>
          <>
            <h2 id="pod-title">Bukti Pengiriman (POD)</h2>
            <PodForm
              trip={podTrip}
              detail={detail?.id === podTrip.id ? detail : null}
              online={online}
              onClose={() => {
                setPodTripId(null);
              }}
              onSubmitted={() => {
                void loadTrips(false);
                void loadDetail(podTrip.id);
              }}
              onUnauthenticated={sessionExpired}
            />
          </>
        </FieldDialog>
      )}
    </main>
  );
}