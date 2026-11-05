"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FilePlus,
  KeyRound,
  Map as MapIcon,
  Navigation,
  PackageCheck,
  Printer,
  Radio,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { FleetMap } from "@/components/fleet-map";
import {
  apiBaseUrl,
  getCurrentSession,
  getDashboardData,
  getPlatformDashboardSummary,
  getPlatformGeofences,
  getPlatformTenants,
  getSessionRole,
  hasPermission,
  hasPlatformPermission,
  isPlatformAdmin,
  type DashboardData,
  type ExceptionSummary,
  type PlatformDashboardSummary,
  type PlatformGeofence,
  type SessionUser,
  type TenantSummary,
  type TripSummary,
} from "@/lib/api";

type MapFilter = "all" | "active" | "attention" | "stale" | "verified";
type TripTab = "active" | "attention" | "all";

const activeTripStatuses = new Set([
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
]);

const closedExceptionStatuses = new Set([
  "RESOLVED",
  "FALSE_POSITIVE",
  "DUPLICATE",
  "CLOSED_WITH_NOTE",
]);

const avatarClasses = ["avatar-blue", "avatar-rose", "avatar-green", "avatar-gold"];

const MAP_FILTERS: Array<{ value: MapFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Dalam perjalanan" },
  { value: "attention", label: "Perlu perhatian" },
  { value: "stale", label: "GPS usang" },
  { value: "verified", label: "Terverifikasi" },
];

function formatClock(value: string) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "--";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "--";
  return `${hour}:${minute}`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function tripState(trip: TripSummary): { label: string; tone: string } {
  switch (trip.status) {
    case "COMPLETED":
      return { label: "Selesai", tone: "green" };
    case "DELIVERED":
      return { label: "Terkirim · menunggu review", tone: "green" };
    case "DELIVERY_IN_PROGRESS":
      return { label: "Penyaluran berlangsung", tone: "violet" };
    case "ARRIVAL_VERIFIED":
      return { label: "Tiba terverifikasi", tone: "green" };
    case "ARRIVAL_DETECTED":
      return { label: "Tiba · menunggu verifikasi", tone: "violet" };
    case "IN_TRANSIT":
      return { label: "Dalam perjalanan", tone: "blue" };
    case "READY_TO_DEPART":
      return { label: "Siap berangkat", tone: "amber" };
    case "SCHEDULED":
      return { label: "Terjadwal", tone: "blue" };
    case "CANCELLED":
      return { label: "Dibatalkan", tone: "red" };
    case "EXCEPTION":
      return { label: "Perlu perhatian", tone: "red" };
    default:
      return { label: "Draf", tone: "blue" };
  }
}

function exceptionLevel(exception: ExceptionSummary): { label: string; tone: string } {
  if (exception.severity === "CRITICAL") return { label: "Kritis", tone: "red" };
  if (exception.severity === "HIGH") return { label: "Tinggi", tone: "amber" };
  return { label: "Perhatian", tone: "amber" };
}

function severityRank(severity: ExceptionSummary["severity"]) {
  if (severity === "CRITICAL") return 3;
  if (severity === "HIGH") return 2;
  return 1;
}

function tripNeedsAttention(trip: TripSummary, now: number) {
  const gpsNeedsAttention = ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(trip.trackingStatus);
  const isLate = activeTripStatuses.has(trip.status) && new Date(trip.plannedArrivalAt).getTime() < now;
  return trip.status === "EXCEPTION" || gpsNeedsAttention || isLate;
}

function tripUrgencyScore(trip: TripSummary, now: number) {
  let score = 0;
  if (trip.status === "EXCEPTION") score += 100;
  if (tripNeedsAttention(trip, now)) score += 50;
  if (activeTripStatuses.has(trip.status)) score += 20;
  if (trip.status === "READY_TO_DEPART" || trip.status === "SCHEDULED") score += 10;
  if (trip.status === "COMPLETED" || trip.status === "CANCELLED") score -= 10;
  return score;
}

function matchesMapFilter(trip: TripSummary, filter: MapFilter, now: number) {
  if (filter === "active") return activeTripStatuses.has(trip.status);
  if (filter === "attention") return tripNeedsAttention(trip, now);
  if (filter === "stale") return ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(trip.trackingStatus);
  if (filter === "verified") return ["VERIFIED", "OVERRIDDEN"].includes(trip.verificationStatus);
  return true;
}

function trackingLabel(status: string) {
  switch (status) {
    case "LIVE": return "Diperbarui";
    case "STALE": return "Usang";
    case "OFFLINE": return "Offline";
    case "GPS_UNAVAILABLE": return "GPS tidak tersedia";
    case "ENDED": return "Pelacakan berakhir";
    default: return "Belum tersedia";
  }
}

function formatCoordinate(value: string | number) {
  return Number(value).toFixed(5);
}

function StatusPill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{children}</span>;
}

export default function Home() {
  const router = useRouter();
  const mapSectionRef = useRef<HTMLElement>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [selectedMapTripId, setSelectedMapTripId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [tripTab, setTripTab] = useState<TripTab>("active");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error" | "forbidden">("checking");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [platformSummary, setPlatformSummary] = useState<PlatformDashboardSummary | null>(null);
  const [platformGeofences, setPlatformGeofences] = useState<PlatformGeofence[]>([]);
  const [platformTenants, setPlatformTenants] = useState<TenantSummary[]>([]);
  // Filter tenant belum punya kontrol UI; disimpan sebagai konstanta agar mudah diaktifkan.
  const tenantFilter: string | undefined = undefined;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (user: SessionUser, silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const data = await getDashboardData(user);
      setDashboard(data);
      setSessionState("ready");
      setRefreshError(null);

      if (isPlatformAdmin(user)) {
        try {
          setPlatformSummary(await getPlatformDashboardSummary());
        } catch {
          // Governance counters are supplementary; keep the previous snapshot.
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      if (error instanceof Error && error.message === "REQUEST_FAILED_403") {
        setSessionState("forbidden");
        return;
      }
      if (silent) {
        setRefreshError("Pembaruan otomatis gagal. Data terakhir tetap ditampilkan.");
      } else {
        setRefreshError(
          error instanceof Error && error.message.startsWith("REQUEST_FAILED_")
            ? error.message
            : "Gangguan saat memuat data operasional.",
        );
        setSessionState("data-error");
      }
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    void (async () => {
      let user: SessionUser;
      try {
        user = await getCurrentSession();
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setSessionState("unavailable");
        return;
      }

      if (!active) return;
      setSessionUser(user);

      if (!hasPermission(user, "trip:read") && !hasPermission(user, "exception:read")) {
        if (user.tenantRole) {
          router.replace(user.tenantRole === "TENANT_DRIVER" ? "/radarapp/driver" : "/tenant");
          return;
        }
        if (user.tenantMemberships?.length) {
          router.replace("/tenant");
          return;
        }
        setSessionState("forbidden");
        return;
      }

      await loadDashboard(user, false);
    })();

    return () => { active = false; };
  }, [router, loadDashboard]);

  const handleRefresh = useCallback(async (silent = true) => {
    if (!sessionUser) return;
    setRefreshing(true);
    try {
      await loadDashboard(sessionUser, silent);
    } finally {
      setRefreshing(false);
    }
  }, [sessionUser, loadDashboard]);

  useEffect(() => {
    if (!sessionUser || sessionState !== "ready") return;
    const interval = window.setInterval(() => { void handleRefresh(true); }, 60_000);
    return () => window.clearInterval(interval);
  }, [sessionUser, sessionState, handleRefresh]);

  // Fetch platform geofences when session is ready, lalu sinkronkan ulang berkala
  // agar geofence yang baru dibuat dari halaman tenant langsung terlihat.
  const loadPlatformGeofences = useCallback(async () => {
    try {
      const geofences = await getPlatformGeofences(tenantFilter, true);
      setPlatformGeofences(geofences);
      const tenants = await getPlatformTenants();
      setPlatformTenants(tenants);
    } catch {
      // Silently ignore fetch errors - geofences are supplementary
    }
  }, [tenantFilter]);

  useEffect(() => {
    if (!sessionUser || sessionState !== "ready") return;
    if (!hasPlatformPermission(sessionUser, "geofence:read")) return;
    const initial = window.setTimeout(() => { void loadPlatformGeofences(); }, 0);
    const interval = window.setInterval(() => { void loadPlatformGeofences(); }, 30_000);
    const handleFocus = () => { void loadPlatformGeofences(); };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [sessionUser, sessionState, loadPlatformGeofences]);

  useEffect(() => {
    if (!mapExpanded) return;
    const node = mapSectionRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMapExpanded(false);
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    node?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mapExpanded]);

  async function logout() {
    if (!apiBaseUrl) {
      router.replace("/login");
      return;
    }

    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });
      const { csrfToken } = await csrfResponse.json() as { csrfToken?: string };
      if (csrfToken) {
        await fetch(`${apiBaseUrl}/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: { "x-csrf-token": csrfToken },
        });
      }
    } finally {
      router.replace("/login");
    }
  }

  if (sessionState === "checking") {
    return <main className="session-state"><span className="session-spinner" /><p>Memuat data operasional…</p></main>;
  }

  if (sessionState === "unavailable" || !sessionUser) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Dashboard tidak dapat memverifikasi sesi. Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  if (sessionState === "forbidden") {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>Peran <strong>{getSessionRole(sessionUser)}</strong> belum memiliki izin membaca perjalanan atau exception. Hubungi administrator untuk penugasan role.</p>{sessionUser.mfaEnabled === false && <Link className="session-retry" href="/security/mfa">Siapkan MFA untuk akun administratif</Link>}<button className="session-retry" onClick={logout}>Keluar</button></main>;
  }

  if (sessionState === "data-error" || !dashboard) {
    const errorMessage = refreshError?.startsWith("REQUEST_FAILED_")
      ? `API menolak atau gagal memproses permintaan (${refreshError.replace("REQUEST_FAILED_", "HTTP ")}).`
      : refreshError
        ? `API tidak dapat memuat data operasional (${refreshError}).`
        : "API tidak dapat memuat data operasional. Periksa koneksi API lalu coba lagi.";
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Data operasional gagal dimuat</h1><p>{errorMessage}</p><button className="session-retry" onClick={() => void handleRefresh(false)}>Coba lagi</button></main>;
  }

  const trips = dashboard.trips;
  const dashboardNow = new Date(dashboard.refreshedAt).getTime();
  const exceptions = dashboard.exceptions;
  const activeExceptions = exceptions.filter((exception) => !closedExceptionStatuses.has(exception.status));
  const criticalExceptions = activeExceptions.filter((exception) => exception.severity === "CRITICAL");
  const highExceptions = activeExceptions.filter((exception) => exception.severity === "HIGH");
  const attentionExceptions = activeExceptions.filter((exception) => exception.severity === "ATTENTION");
  const sortedExceptions = [...activeExceptions].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const inTransitTrips = trips.filter((trip) => activeTripStatuses.has(trip.status));
  const verifiedTrips = trips.filter((trip) => ["VERIFIED", "OVERRIDDEN"].includes(trip.verificationStatus));
  const completedTrips = trips.filter((trip) => trip.status === "COMPLETED");
  const verifiedPct = trips.length ? Math.round((verifiedTrips.length / trips.length) * 1000) / 10 : 0;
  const locatedTrips = trips.filter((trip) => trip.positions.length > 0);
  const mapTrips = locatedTrips.filter((trip) => matchesMapFilter(trip, mapFilter, dashboardNow));
  const selectedMapTrip = mapTrips.find((trip) => trip.id === selectedMapTripId) ?? null;
  const selectedPosition = selectedMapTrip?.positions[0] ?? null;
  const staleGpsTrips = locatedTrips.filter((trip) => ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(trip.trackingStatus));
  const latestPositionAt = locatedTrips.reduce<string | null>((latest, trip) => {
    const received = trip.positions[0]?.serverReceivedAt ?? null;
    if (!received) return latest;
    return !latest || new Date(received) > new Date(latest) ? received : latest;
  }, null);
  const freshnessStale = !latestPositionAt || dashboardNow - new Date(latestPositionAt).getTime() > 10 * 60_000;
  const activeSppg = dashboard.sppgs?.filter((sppg) => sppg.status === "ACTIVE").length ?? null;
  const pendingSppg = activeSppg === null ? null : Math.max(0, dashboard.sppgTotal - activeSppg);
  const canReadTrips = hasPermission(sessionUser, "trip:read");
  const canReadExceptions = hasPermission(sessionUser, "exception:read");
  const canReadMaster = hasPermission(sessionUser, "master:read");
  const canDrive = hasPermission(sessionUser, "trip:start") && hasPermission(sessionUser, "trip:location:update");
  const canAccessApprovals = hasPermission(sessionUser, "sppg:manage") || hasPermission(sessionUser, "approval:review");
  const canReadAudit = hasPermission(sessionUser, "audit:read");
  const canManageUsers = hasPermission(sessionUser, "admin:manage_users");
  const platformAdmin = isPlatformAdmin(sessionUser);
  const kpiCount = [canReadMaster, canReadTrips, canReadTrips, canReadExceptions].filter(Boolean).length;

  const sortedTrips = [...trips].sort(
    (a, b) => tripUrgencyScore(b, dashboardNow) - tripUrgencyScore(a, dashboardNow)
      || new Date(a.plannedArrivalAt).getTime() - new Date(b.plannedArrivalAt).getTime(),
  );
  const attentionTrips = sortedTrips.filter((trip) => tripNeedsAttention(trip, dashboardNow));
  const activeTrips = sortedTrips.filter((trip) => activeTripStatuses.has(trip.status));
  const tabTrips = tripTab === "active" ? activeTrips : tripTab === "attention" ? attentionTrips : sortedTrips;
  const visibleTrips = tabTrips.slice(0, 6);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#dashboard-main">Lewati ke konten utama</a>
      <AppSidebar />

      <section className="main-column" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Platform</span><ChevronRight size={14} /><strong>Ringkasan</strong></div>
          <div className="topbar-actions">
            <span className="environment"><span className="live-dot" />DATA OPERASIONAL</span>
            {canReadExceptions && (
              <Link className="icon-button notification-button" href="/exceptions" aria-label={`Notifikasi: ${activeExceptions.length} exception aktif`}>
                <Bell size={17} />
                {activeExceptions.length > 0 && <span className="notification-count">{activeExceptions.length > 99 ? "99+" : activeExceptions.length}</span>}
              </Link>
            )}
            <span className="topbar-divider" />
            <HeaderAccount user={sessionUser} />
          </div>
        </header>

        <main className="content-area dashboard-content" id="dashboard-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                {new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()).toUpperCase()}
              </div>
              <h1>Selamat {Number(new Intl.DateTimeFormat("id-ID", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date())) < 12 ? "pagi" : "siang"}, {sessionUser.displayName.split(" ")[0]}</h1>
              <p>Gambaran distribusi dan tata kelola platform dari data operasional RADAR MBG.</p>
            </div>
            <div className="page-heading-actions">
              <button className="export-button" onClick={() => void handleRefresh(true)} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
                {refreshing ? "Memuat…" : "Muat ulang"}
              </button>
              <button className="export-button" onClick={() => window.print()}>
                <Printer size={15} />
                Cetak
              </button>
            </div>
          </div>

          <div className="demo-notice">
            <span className="notice-mark">i</span>
            <span><strong>Data operasional</strong> — diperbarui otomatis setiap 60 detik. Terakhir dimuat {formatClock(dashboard.refreshedAt)} WIB.</span>
            {refreshError && (
              <button type="button" onClick={() => setRefreshError(null)} aria-label="Tutup peringatan pembaruan">
                <X size={14} />
              </button>
            )}
          </div>
          {refreshError && <p className="refresh-warning" role="status">{refreshError}</p>}

          {canReadExceptions && criticalExceptions.length > 0 && (
            <section className="critical-banner" role="alert">
              <span className="critical-banner-icon"><AlertTriangle size={18} /></span>
              <div>
                <strong>{criticalExceptions.length} exception kritis belum ditangani</strong>
                <span>Prioritaskan penanganan sebelum menutup shift operasional.</span>
              </div>
              <Link className="btn btn-primary btn-sm" href="/exceptions">Tangani</Link>
            </section>
          )}

          <section className={`kpi-grid kpi-grid-${kpiCount}`} aria-label="Ringkasan operasional">
            {canReadMaster && (
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-navy"><Utensils size={17} /></span><span className="kpi-trend trend-neutral">Data master</span></div>
                <p className="kpi-label">SPPG aktif</p>
                <div className="kpi-value">{activeSppg ?? "—"} <span>/ {dashboard.sppgs ? dashboard.sppgTotal : "—"}</span></div>
                <div className="kpi-foot">{pendingSppg === null ? "Data SPPG tidak tersedia" : `${pendingSppg} belum aktif`}</div>
              </article>
            )}
            {canReadTrips && (
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-blue"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Hari ini</span></div>
                <p className="kpi-label">Perjalanan hari ini</p>
                <div className="kpi-value">{dashboard.tripTotal} <span>perjalanan</span></div>
                <div className="kpi-foot"><span className="kpi-dot blue-dot" />{inTransitTrips.length} aktif <span className="kpi-separator">·</span> {completedTrips.length} selesai</div>
              </article>
            )}
            {canReadTrips && (
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-green"><PackageCheck size={17} /></span><span className="kpi-trend trend-neutral">Verifikasi</span></div>
                <p className="kpi-label">Penyaluran terverifikasi</p>
                <div className="kpi-value">{verifiedPct}<span className="unit">%</span></div>
                <div className="kpi-foot"><span className="progress-track"><i style={{ width: `${Math.min(100, verifiedPct)}%` }} /></span><span>{verifiedTrips.length} dari {trips.length} perjalanan termuat</span></div>
              </article>
            )}
            {canReadExceptions && (
              <article className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon icon-amber"><AlertTriangle size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
                <p className="kpi-label">Perlu perhatian</p>
                <div className="kpi-value">{activeExceptions.length} <span>exception aktif</span></div>
                <div className="kpi-foot"><span className="severity"><i />{criticalExceptions.length} kritis</span><span className="kpi-separator">·</span><span>{highExceptions.length + attentionExceptions.length} lainnya</span></div>
              </article>
            )}
          </section>

          {platformAdmin && platformSummary && (
            <section className="panel governance-panel" aria-label="Tata kelola platform">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Tata kelola platform</h2><span className="count-chip">Superadmin</span></div>
                  <p>Status tenant, pendaftaran, dan persetujuan lintas organisasi.</p>
                </div>
                <Link className="text-link" href="/tenant">Kelola tenant<ArrowRight size={14} /></Link>
              </div>
              <div className="gov-grid">
                <Link className="gov-card" href="/tenant">
                  <span className="gov-icon icon-navy"><Building2 size={17} /></span>
                  <span className="gov-copy"><small>Tenant aktif</small><strong>{platformSummary.tenants.active} <i>/ {platformSummary.tenants.total}</i></strong><span>{platformSummary.tenants.pendingActivation} menunggu aktivasi · {platformSummary.tenants.suspended} ditangguhkan</span></span>
                </Link>
                <div className="gov-card">
                  <span className="gov-icon icon-blue"><FilePlus size={17} /></span>
                  <span className="gov-copy"><small>Pendaftaran SPPG</small><strong>{platformSummary.registrations.pendingReview}</strong><span>menunggu review</span></span>
                </div>
                <Link className="gov-card" href="/approvals">
                  <span className="gov-icon icon-amber"><ClipboardCheck size={17} /></span>
                  <span className="gov-copy"><small>Persetujuan</small><strong>{platformSummary.approvals.pending}</strong><span>menunggu keputusan</span></span>
                </Link>
                <Link className="gov-card" href="/sppg">
                  <span className="gov-icon icon-green"><Utensils size={17} /></span>
                  <span className="gov-copy"><small>SPPG aktif</small><strong>{activeSppg ?? "—"} <i>/ {dashboard.sppgs ? dashboard.sppgTotal : "—"}</i></strong><span>{pendingSppg === null ? "Data belum tersedia" : `${pendingSppg} belum aktif`}</span></span>
                </Link>
              </div>
            </section>
          )}

          <div className="dashboard-main-grid">
            <section
              ref={mapSectionRef}
              className={`map-section ${mapExpanded ? "map-section-expanded" : ""}`}
              id="live-map"
              tabIndex={-1}
              role={mapExpanded ? "dialog" : undefined}
              aria-modal={mapExpanded || undefined}
              aria-label="Peta situasi armada"
            >
              <div className="section-heading">
                <div>
                  <div className="section-title-row"><h2>Situasi armada</h2><span className="sample-tag"><span />GPS</span></div>
                  <p>Lokasi terakhir yang diterima server · {locatedTrips.length} dari {trips.length} perjalanan memiliki koordinat</p>
                </div>
                <div className="map-actions">
                  <button className="square-button map-expand-control" aria-label={mapExpanded ? "Tutup tampilan peta" : "Perluas peta"} aria-pressed={mapExpanded} onClick={() => setMapExpanded((expanded) => !expanded)}>
                    {mapExpanded ? <X size={16} /> : <MapIcon size={16} />}
                  </button>
                </div>
              </div>
              <div className="map-frame">
                <div className="map-visual" aria-label="Peta posisi armada berdasarkan GPS terakhir">
                  <FleetMap
                    trips={mapTrips}
                    selectedTripId={selectedMapTripId}
                    onSelectTrip={(trip) => setSelectedMapTripId(trip.id)}
                    emptyMessage={locatedTrips.length && mapFilter !== "all" ? "Tidak ada perjalanan sesuai filter peta." : undefined}
                    expanded={mapExpanded}
                    geofenceCircles={platformGeofences}
                  />
                  <div className="map-top-label">
                    <span className="map-live-icon"><Radio size={14} /></span>
                    <span><strong>Lokasi terakhir diterima</strong><small>Marker bukan jaminan posisi saat ini · pilih marker untuk detail</small></span>
                  </div>
                </div>
                <div className="map-legend" aria-label="Filter tampilan peta">
                  <span className="legend-caption">Tampilkan</span>
                  {MAP_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      className={`legend-chip ${mapFilter === filter.value ? "active" : ""}`}
                      aria-pressed={mapFilter === filter.value}
                      onClick={() => {
                        setMapFilter(filter.value);
                        setSelectedMapTripId(null);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                  {staleGpsTrips.length > 0 && <span className="legend-stale-count">{staleGpsTrips.length} GPS usang</span>}
                  <span className="legend-divider" />
                  <div className={`legend-freshness ${freshnessStale ? "is-stale" : ""}`}>
                    <span className="freshness-dot" />{freshnessStale ? "GPS terakhir > 10 menit" : `Terakhir diterima ${latestPositionAt ? relativeTime(latestPositionAt) : "belum tersedia"}`}
                  </div>
                  {/* Geofence filter controls */}
                  {platformGeofences.length > 0 && (
                    <>
                      <span className="legend-geofence-toggle">
                        <input
                          type="checkbox"
                          checked={mapFilter !== "stale"}
                          onChange={() => setMapFilter((prev) => (prev === "stale" ? "all" : prev))}
                          id="geofence-legend-toggle"
                          aria-label="Tampilkan geofence di peta"
                        />
                        <label htmlFor="geofence-legend-toggle">
                          <span className="legend-geofence-dot" />
                          Geofence
                        </label>
                      </span>
                      {tenantFilter && (
                        <span className="legend-geofence-filter-text">
                          {platformTenants.find((t) => t.id === tenantFilter)?.tenantCode ?? "Semua tenant"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {selectedMapTrip && selectedPosition && (
                <article className="map-selection-panel" aria-live="polite">
                  <div className="map-selection-heading">
                    <div>
                      <span className="map-selection-eyebrow">DETAIL MARKER TERPILIH</span>
                      <strong>{selectedMapTrip.vehicle.plateNumber} · {selectedMapTrip.driver.name}</strong>
                      <small>{selectedMapTrip.sppg.name} → {selectedMapTrip.deliveryLocation.name}</small>
                    </div>
                    <StatusPill tone={tripState(selectedMapTrip).tone}>{tripState(selectedMapTrip).label}</StatusPill>
                  </div>
                  <div className="map-selection-meta">
                    <span><strong>GPS {trackingLabel(selectedMapTrip.trackingStatus)}</strong><small>{relativeTime(selectedPosition.serverReceivedAt)} · {formatClock(selectedPosition.serverReceivedAt)} WIB</small></span>
                    <span><strong>Koordinat WGS84</strong><small>{formatCoordinate(selectedPosition.latitude)}, {formatCoordinate(selectedPosition.longitude)}</small></span>
                    <span><strong>Akurasi</strong><small>{selectedPosition.accuracyMeters === null ? "Tidak tersedia" : `${Number(selectedPosition.accuracyMeters).toFixed(0)} m`}</small></span>
                  </div>
                  {canReadTrips && <Link className="map-selection-link" href={`/trips/${selectedMapTrip.id}`}>Buka detail perjalanan<ArrowRight size={14} /></Link>}
                </article>
              )}
            </section>

            {canReadExceptions && (
              <aside className="panel alert-panel" aria-label="Perlu perhatian">
                <div className="panel-heading">
                  <div>
                    <div className="section-title-row"><h2>Perlu perhatian</h2><span className="alert-count">{activeExceptions.length}</span></div>
                    <p>Prioritas tindak lanjut operasional</p>
                  </div>
                </div>
                <div className="alert-list">
                  {sortedExceptions.slice(0, 5).map((exception) => {
                    const level = exceptionLevel(exception);
                    const Icon = exception.severity === "CRITICAL" ? AlertTriangle : exception.severity === "HIGH" ? Clock3 : ShieldCheck;
                    return (
                      <Link className="alert-row" key={exception.id} href="/exceptions">
                        <span className={`alert-icon alert-${level.tone}`}><Icon size={16} /></span>
                        <div className="alert-copy">
                          <strong>{exception.title}</strong>
                          <span>{exception.sppg.name} · {relativeTime(exception.openedAt)}</span>
                        </div>
                        <StatusPill tone={level.tone}>{level.label}</StatusPill>
                      </Link>
                    );
                  })}
                  {!activeExceptions.length && <p className="alert-empty">Tidak ada exception aktif.</p>}
                </div>
                <Link className="alert-footer" href="/exceptions">Buka pusat risiko<ArrowRight size={14} /></Link>
              </aside>
            )}
          </div>

          <section className="panel trips-panel" aria-label="Perjalanan terkini">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Perjalanan terkini</h2><span className="count-chip">{inTransitTrips.length} aktif</span></div>
                <p>Diurutkan berdasarkan urgensi, lalu estimasi tiba.</p>
              </div>
              <Link className="text-link" href="/trips">Semua perjalanan<ArrowRight size={14} /></Link>
            </div>
            <div className="table-tabs" role="tablist" aria-label="Filter perjalanan">
              <button type="button" role="tab" aria-selected={tripTab === "active"} className={`table-tab ${tripTab === "active" ? "active" : ""}`} onClick={() => setTripTab("active")}>Aktif <span>{activeTrips.length}</span></button>
              <button type="button" role="tab" aria-selected={tripTab === "attention"} className={`table-tab ${tripTab === "attention" ? "active" : ""}`} onClick={() => setTripTab("attention")}>Perlu perhatian <span>{attentionTrips.length}</span></button>
              <button type="button" role="tab" aria-selected={tripTab === "all"} className={`table-tab ${tripTab === "all" ? "active" : ""}`} onClick={() => setTripTab("all")}>Semua <span>{sortedTrips.length}</span></button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>PERJALANAN</th><th>RUTE &amp; PENGEMUDI</th><th>STATUS</th><th>PORSI</th><th>ETA</th><th><span className="sr-only">Aksi</span></th></tr>
                </thead>
                <tbody>
                  {visibleTrips.map((trip, index) => {
                    const state = tripState(trip);
                    return (
                      <tr key={trip.id}>
                        <td><Link className="trip-id trip-detail-link" href={`/trips/${trip.id}`}>TRP-{trip.id.slice(0, 8).toUpperCase()}</Link><span className="table-sub">{trip.vehicle.plateNumber} <i>·</i> {formatClock(trip.plannedDepartureAt)}</span></td>
                        <td><div className="driver-cell"><span className={`driver-avatar ${avatarClasses[index % avatarClasses.length]}`}>{initials(trip.driver.name)}</span><span className="route-copy"><strong>{trip.sppg.name} → {trip.deliveryLocation.name}</strong><small>{trip.driver.name}</small></span></div></td>
                        <td><StatusPill tone={state.tone}>{state.label}</StatusPill></td>
                        <td><span className="portion-value">{trip.plannedQuantity} porsi</span></td>
                        <td><span className="eta-value">{trip.status === "COMPLETED" ? "Selesai" : trip.status === "CANCELLED" ? "—" : formatClock(trip.plannedArrivalAt)}</span></td>
                        <td><Link className="row-detail-link" href={`/trips/${trip.id}`}>Detail<ArrowRight size={13} /></Link></td>
                      </tr>
                    );
                  })}
                  {!visibleTrips.length && (
                    <tr><td colSpan={6} className="table-empty">Belum ada perjalanan pada filter ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Link className="mobile-all-link" href="/trips">Lihat semua perjalanan<ArrowRight size={14} /></Link>
          </section>

          <section className="panel quick-panel">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Aksi platform</h2></div>
                <p>Pintasan tugas administrator platform dan operasional.</p>
              </div>
            </div>
            <div className="app-link-row">
              {platformAdmin && <Link href="/tenant" className="app-link-card"><Building2 size={20} /><span>Tenant</span></Link>}
              <Link href="/sppg" className="app-link-card"><Utensils size={20} /><span>SPPG</span></Link>
              {canAccessApprovals && <Link href="/approvals" className="app-link-card"><ClipboardCheck size={20} /><span>Persetujuan</span></Link>}
              {canReadAudit && <Link href="/audit" className="app-link-card"><Activity size={20} /><span>Audit explorer</span></Link>}
              <Link href="/reporting" className="app-link-card"><BarChart3 size={20} /><span>Laporan</span></Link>
              <Link href="/register" className="app-link-card"><FilePlus size={20} /><span>Pendaftaran SPPG</span></Link>
              <Link href="/register/status" className="app-link-card"><KeyRound size={20} /><span>Status pendaftaran</span></Link>
              {canManageUsers && <Link href="/users" className="app-link-card"><Users size={20} /><span>Administrasi akun</span></Link>}
              {canDrive && <Link href="/driver" className="app-link-card"><Navigation size={20} /><span>Mode pengemudi</span></Link>}
            </div>
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> Dimuat {formatClock(dashboard.refreshedAt)} WIB</span>
          </footer>
        </main>
      </section>
    </div>
  );
}
