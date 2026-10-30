"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock3,
  BarChart3,
  Building2,
  Command,
  ClipboardCheck,
  Download,
  FilePlus,
  KeyRound,
  Filter,
  Map as MapIcon,
  MapPinned,
  LayoutDashboard,
  ListFilter,

  MoreHorizontal,
  Navigation,
  PackageCheck,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { FleetMap } from "@/components/fleet-map";
import {
  apiBaseUrl,
  getCurrentSession,
  getDashboardData,
  getSessionRole,
  hasPermission,
  type DashboardData,
  type ExceptionSummary,
  type SessionUser,
  type TripSummary,
} from "@/lib/api";

type NavItem = { label: string; icon: typeof LayoutDashboard; href?: string; count?: string; alert?: boolean; permissions?: string[] };
type MapFilter = "all" | "active" | "attention" | "stale" | "verified";

const navigation: NavItem[] = [
  { label: "Ringkasan", icon: LayoutDashboard },
  { label: "Peta langsung", icon: MapIcon, permissions: ["trip:track:read"] },
  { label: "Perjalanan", icon: Navigation, permissions: ["trip:read"] },
  { label: "Pusat risiko", icon: AlertTriangle, alert: true, permissions: ["exception:read"] },
];

const management: NavItem[] = [
  { label: "SPPG", icon: Utensils, href: "/sppg", permissions: ["master:read", "sppg:read", "organization:read"] },
  { label: "Driver", icon: Users, href: "/drivers", permissions: ["master:read"] },
  { label: "Kendaraan", icon: Truck, href: "/vehicles", permissions: ["master:read"] },
];

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
  return { label: "Perhatian", tone: "violet" };
}

function tripNeedsAttention(trip: TripSummary, now: number) {
  const gpsNeedsAttention = ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(trip.trackingStatus);
  const isLate = activeTripStatuses.has(trip.status) && new Date(trip.plannedArrivalAt).getTime() < now;
  return trip.status === "EXCEPTION" || gpsNeedsAttention || isLate;
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
  const [activeNav, setActiveNav] = useState("Ringkasan");
  const [showAlerts, setShowAlerts] = useState(true);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [selectedMapTripId, setSelectedMapTripId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error" | "forbidden">("checking");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

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
        setSessionState("forbidden");
        return;
      }

      try {
        const data = await getDashboardData(user);
        if (!active) return;
        setDashboard(data);
        setSessionState("ready");
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setSessionState("data-error");
      }
    })();

    return () => { active = false; };
  }, [router]);

  function openSection(label: string) {
    if (label === "Peta langsung") {
      setActiveNav(label);
      document.getElementById("live-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (label === "Perjalanan") {
      router.push("/trips");
      return;
    }
    if (label === "Pusat risiko") {
      router.push("/exceptions");
      return;
    }
    setActiveNav(label);
  }

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
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Data operasional gagal dimuat</h1><p>Sesi valid, tetapi API trip/exception tidak merespons. Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  const trips = dashboard.trips;
  const dashboardNow = new Date(dashboard.refreshedAt).getTime();
  const exceptions = dashboard.exceptions;
  const activeExceptions = exceptions.filter((exception) => !closedExceptionStatuses.has(exception.status));
  const criticalExceptions = activeExceptions.filter((exception) => exception.severity === "CRITICAL");
  const highExceptions = activeExceptions.filter((exception) => exception.severity === "HIGH");
  const attentionExceptions = activeExceptions.filter((exception) => exception.severity === "ATTENTION");
  const inTransitTrips = trips.filter((trip) => activeTripStatuses.has(trip.status));
  const verifiedTrips = trips.filter((trip) => ["VERIFIED", "OVERRIDDEN"].includes(trip.verificationStatus));
  const completedTrips = trips.filter((trip) => trip.status === "COMPLETED");
  const verifiedPct = dashboard.tripTotal
    ? Math.round((verifiedTrips.length / dashboard.tripTotal) * 1000) / 10
    : 0;
  const locatedTrips = trips.filter((trip) => trip.positions.length > 0);
  const mapTrips = locatedTrips.filter((trip) => matchesMapFilter(trip, mapFilter, dashboardNow));
  const selectedMapTrip = mapTrips.find((trip) => trip.id === selectedMapTripId) ?? null;
  const selectedPosition = selectedMapTrip?.positions[0] ?? null;
  const arrivalTrips = locatedTrips.filter((trip) => ["ARRIVAL_DETECTED", "ARRIVAL_VERIFIED", "DELIVERY_IN_PROGRESS"].includes(trip.status));
  const staleGpsTrips = locatedTrips.filter((trip) => ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(trip.trackingStatus));
  const latestPositionAt = locatedTrips.reduce<string | null>((latest, trip) => {
    const received = trip.positions[0]?.serverReceivedAt ?? null;
    if (!received) return latest;
    return !latest || new Date(received) > new Date(latest) ? received : latest;
  }, null);
  const activeSppg = dashboard.sppgs?.filter((sppg) => sppg.status === "ACTIVE").length ?? null;
  const pendingSppg = activeSppg === null ? null : Math.max(0, dashboard.sppgTotal - activeSppg);
  const canReadTrips = hasPermission(sessionUser, "trip:read");
  const canReadExceptions = hasPermission(sessionUser, "exception:read");
  const canReadMaster = hasPermission(sessionUser, "master:read");
  const canManageAdmin = hasPermission(sessionUser, "admin:manage_users") || hasPermission(sessionUser, "admin:manage_roles");
  const canDrive = hasPermission(sessionUser, "trip:start") && hasPermission(sessionUser, "trip:location:update");
  const canAccessApprovals = hasPermission(sessionUser, "sppg:manage") || hasPermission(sessionUser, "approval:review");
  const canReadAudit = hasPermission(sessionUser, "audit:read");
  const canAccessGeofences = hasPermission(sessionUser, "geofence:read") || hasPermission(sessionUser, "geofence:manage");
  const canManageUsers = hasPermission(sessionUser, "admin:manage_users");
  const canAccessNav = (item: NavItem) => !item.permissions || item.permissions.some((permission) => hasPermission(sessionUser, permission));
  const navItems = navigation.filter(canAccessNav).map((item) => {
    if (item.label === "Perjalanan") return { ...item, count: String(inTransitTrips.length) };
    if (item.label === "Pusat risiko") return { ...item, count: String(activeExceptions.length) };
    return item;
  });
  const managementItems = management.filter(canAccessNav);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="RADAR MBG beranda">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-copy"><strong>RADAR<span>MBG</span></strong><small>Operational intelligence</small></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-icon"><Command size={17} /></span>
          <span className="workspace-copy"><small>WORKSPACE</small><strong>Pusat Operasional</strong></span>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <nav className="side-nav" aria-label="Navigasi utama">
          <p className="nav-caption">MONITORING</p>
          {navItems.map(({ label, icon: Icon, count, alert }) => (
            <button key={label} className={`nav-item ${activeNav === label ? "nav-active" : ""}`} onClick={() => openSection(label)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {count && <span className={`nav-count ${alert ? "nav-count-alert" : ""}`}>{count}</span>}
            </button>
          ))}
          <p className="nav-caption nav-caption-spaced">OPERASIONAL</p>
          {managementItems.map(({ label, icon: Icon, href }) => (
            <Link key={label} className="nav-item nav-link" href={href ?? "/"}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
          {canReadAudit && <Link className="nav-item nav-link" href="/audit"><Activity size={17} strokeWidth={1.8} /><span>Audit explorer</span></Link>}
          {canAccessGeofences && <Link className="nav-item nav-link" href="/geofences"><MapPinned size={17} strokeWidth={1.8} /><span>Geofence</span></Link>}
          {canManageUsers && <Link className="nav-item nav-link" href="/users"><Users size={17} strokeWidth={1.8} /><span>Administrasi akun</span></Link>}
          {sessionUser.mfaEnabled === false && <Link className="nav-item nav-link" href="/security/mfa"><ShieldCheck size={17} strokeWidth={1.8} /><span>Daftarkan MFA</span></Link>}
          {canAccessApprovals && <Link className="nav-item nav-link" href="/approvals"><ClipboardCheck size={17} strokeWidth={1.8} /><span>Persetujuan</span></Link>}
          {canDrive && (
            <>
              <p className="nav-caption nav-caption-spaced">PENGEMUDI</p>
              <Link className="nav-item nav-link" href="/driver">
                <Navigation size={17} strokeWidth={1.8} /><span>Mode pengemudi</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help"><div className="help-icon"><Activity size={17} /></div><div><strong>Data operasional</strong><span>Terhubung ke API RADAR MBG</span></div></div>
          {canManageAdmin && <button className="nav-item settings-item nav-item-soon" disabled title="Pengaturan segera hadir"><Settings2 size={17} /><span>Pengaturan</span><small className="nav-soon-tag">Segera</small></button>}

        </div>
      </aside>

      <section className="main-column" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="topbar-actions"><span className="environment"><span className="live-dot" />DATA OPERASIONAL</span><button className="icon-button" aria-label="Cari"><Search size={17} /></button>{canReadExceptions && <button className="icon-button notification-button" aria-label="Notifikasi" onClick={() => setShowAlerts(!showAlerts)}><Bell size={17} /><i /></button>}<span className="topbar-divider" /><HeaderAccount user={sessionUser} /></div>
        </header>

        <div className="content-area">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()).toUpperCase()}</div><h1>Selamat {Number(new Intl.DateTimeFormat("id-ID", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date())) < 12 ? "pagi" : "siang"}, {sessionUser.displayName.split(" ")[0]} <span className="wave">✳</span></h1><p>Gambaran distribusi hari ini dari data operasional RADAR MBG.</p></div><button className="export-button" onClick={() => window.print()}><Download size={15} />Ekspor ringkasan</button></div>

          <div className="demo-notice"><span className="notice-mark">i</span><span><strong>Sumber data</strong> — Ringkasan ini terhubung ke API RADAR MBG. Terakhir dimuat {formatClock(dashboard.refreshedAt)} WIB.</span></div>

          <section className="kpi-grid" aria-label="Ringkasan operasional">
            {canReadMaster && <article className="kpi-card"><div className="kpi-top"><span className="kpi-icon icon-navy"><Utensils size={17} /></span><span className="kpi-trend trend-up">Live</span></div><p className="kpi-label">SPPG aktif</p><div className="kpi-value">{activeSppg ?? "—"} <span>/ {dashboard.sppgs ? dashboard.sppgTotal : "—"}</span></div><div className="kpi-foot"><span className="mini-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span>{pendingSppg === null ? "Data SPPG tidak tersedia" : `${pendingSppg} belum aktif`}</span></div></article>}
            {canReadTrips && <article className="kpi-card"><div className="kpi-top"><span className="kpi-icon icon-blue"><Truck size={17} /></span><span className="kpi-trend trend-up">Hari ini</span></div><p className="kpi-label">Perjalanan hari ini</p><div className="kpi-value">{dashboard.tripTotal} <span>perjalanan</span></div><div className="kpi-foot"><span className="kpi-dot blue-dot" />{inTransitTrips.length} sedang berjalan <span className="kpi-separator">·</span> {completedTrips.length} selesai</div></article>}
            {canReadTrips && <article className="kpi-card"><div className="kpi-top"><span className="kpi-icon icon-green"><PackageCheck size={17} /></span><span className="kpi-trend trend-up">{verifiedPct}%</span></div><p className="kpi-label">Penyaluran terverifikasi</p><div className="kpi-value">{verifiedPct}<span className="unit">%</span></div><div className="kpi-foot"><span className="progress-track"><i style={{ width: `${Math.min(100, verifiedPct)}%` }} /></span><span>{verifiedTrips.length} dari {dashboard.tripTotal} perjalanan</span></div></article>}
            {canReadExceptions && <article className="kpi-card"><div className="kpi-top"><span className="kpi-icon icon-amber"><AlertTriangle size={17} /></span><span className="kpi-trend trend-down">{highExceptions.length + criticalExceptions.length} tinggi</span></div><p className="kpi-label">Perlu perhatian</p><div className="kpi-value">{String(activeExceptions.length).padStart(2, "0")} <span>exception aktif</span></div><div className="kpi-foot"><span className="severity"><i />{criticalExceptions.length} kritis</span><span className="kpi-separator">·</span><span>{attentionExceptions.length} perlu ditinjau</span></div></article>}
          </section>

          <section className={`map-section ${mapExpanded ? "map-section-expanded" : ""}`} id="live-map">
            <div className="section-heading"><div><div className="section-title-row"><h2>Situasi armada</h2><span className="sample-tag"><span />GPS</span></div><p>Lokasi terakhir yang diterima server · {locatedTrips.length} dari {trips.length} perjalanan memiliki koordinat</p></div><div className="map-actions"><label className="map-filter-control"><ListFilter size={14} /><span className="sr-only">Filter perjalanan pada peta</span><select value={mapFilter} aria-label="Filter perjalanan pada peta" onChange={(event) => { setMapFilter(event.target.value as MapFilter); setSelectedMapTripId(null); }}><option value="all">Semua status</option><option value="active">Dalam perjalanan</option><option value="attention">Perlu perhatian</option><option value="stale">GPS usang / offline</option><option value="verified">Terverifikasi</option></select></label><button className="square-button map-expand-control" aria-label={mapExpanded ? "Tutup tampilan peta" : "Perluas peta"} aria-pressed={mapExpanded} onClick={() => setMapExpanded((expanded) => !expanded)}>{mapExpanded ? <X size={16} /> : <MapIcon size={16} />}</button></div></div>
            <div className="map-frame">
              <div className="map-visual" aria-label="Peta posisi armada berdasarkan GPS terakhir">
                <FleetMap trips={mapTrips} selectedTripId={selectedMapTripId} onSelectTrip={(trip) => setSelectedMapTripId(trip.id)} emptyMessage={locatedTrips.length && mapFilter !== "all" ? "Tidak ada perjalanan sesuai filter peta." : undefined} expanded={mapExpanded} />
                <div className="map-top-label"><span className="map-live-icon"><Radio size={14} /></span><span><strong>Lokasi terakhir diterima</strong><small>Marker bukan jaminan posisi saat ini · pilih marker untuk detail</small></span></div>
              </div>
              <div className="map-legend" aria-label="Legenda status peta"><div className="legend-item"><i className="legend-ring legend-blue" /><span>Berjalan</span><b>{locatedTrips.filter((trip) => activeTripStatuses.has(trip.status)).length}</b></div><div className="legend-item"><i className="legend-ring legend-violet" /><span>Tiba / serah-terima</span><b>{arrivalTrips.length}</b></div>{canReadExceptions && <div className="legend-item"><i className="legend-ring legend-amber" /><span>Perhatian</span><b>{locatedTrips.filter((trip) => tripNeedsAttention(trip, dashboardNow)).length}</b></div>}<div className="legend-item"><i className="legend-ring legend-green" /><span>Terverifikasi</span><b>{locatedTrips.filter((trip) => ["VERIFIED", "OVERRIDDEN"].includes(trip.verificationStatus)).length}</b></div>{staleGpsTrips.length > 0 && <div className="legend-item legend-stale"><i className="legend-ring legend-stale-ring" /><span>GPS usang/offline</span><b>{staleGpsTrips.length}</b></div>}<span className="legend-divider" /><div className="legend-freshness"><span className="freshness-dot" />Terakhir diterima {latestPositionAt ? relativeTime(latestPositionAt) : "belum tersedia"}</div></div>
            </div>
            {selectedMapTrip && selectedPosition && <article className="map-selection-panel" aria-live="polite">
              <div className="map-selection-heading"><div><span className="map-selection-eyebrow">DETAIL MARKER TERPILIH</span><strong>{selectedMapTrip.vehicle.plateNumber} · {selectedMapTrip.driver.name}</strong><small>{selectedMapTrip.sppg.name} → {selectedMapTrip.deliveryLocation.name}</small></div><StatusPill tone={tripState(selectedMapTrip).tone}>{tripState(selectedMapTrip).label}</StatusPill></div>
              <div className="map-selection-meta"><span><strong>GPS {trackingLabel(selectedMapTrip.trackingStatus)}</strong><small>{relativeTime(selectedPosition.serverReceivedAt)} · {formatClock(selectedPosition.serverReceivedAt)} WIB</small></span><span><strong>Koordinat WGS84</strong><small>{formatCoordinate(selectedPosition.latitude)}, {formatCoordinate(selectedPosition.longitude)}</small></span><span><strong>Akurasi</strong><small>{selectedPosition.accuracyMeters === null ? "Tidak tersedia" : `${Number(selectedPosition.accuracyMeters).toFixed(0)} m`}</small></span></div>
              {canReadTrips && <Link className="map-selection-link" href={`/trips/${selectedMapTrip.id}`}>Buka detail perjalanan<ArrowRight size={14} /></Link>}
            </article>}
          </section>

          <section className={`bottom-grid ${canReadExceptions && showAlerts ? "" : "bottom-grid-wide"}`}>
            <div className="panel trips-panel"><div className="panel-heading"><div><div className="section-title-row"><h2>Perjalanan terkini</h2><span className="count-chip">{inTransitTrips.length} aktif</span></div><p>Pantau status dan progres distribusi hari ini</p></div><Link className="text-link" href="/trips">Semua perjalanan<ArrowRight size={14} /></Link></div>
              <div className="table-wrap"><table><thead><tr><th>PERJALANAN</th><th>RUTE & PENGEMUDI</th><th>STATUS</th><th>PORSI</th><th>ETA</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{trips.slice(0, 5).map((trip, index) => {
                const state = tripState(trip);
                return (
                  <tr key={trip.id}>
                    <td><Link className="trip-id trip-detail-link" href={`/trips/${trip.id}`}>TRP-{trip.id.slice(0, 8).toUpperCase()}</Link><span className="table-sub">{trip.vehicle.plateNumber} <i>·</i> {formatClock(trip.plannedDepartureAt)}</span></td>
                    <td><div className="driver-cell"><span className={`driver-avatar ${avatarClasses[index % avatarClasses.length]}`}>{initials(trip.driver.name)}</span><span className="route-copy"><strong>{trip.sppg.name} → {trip.deliveryLocation.name}</strong><small>{trip.driver.name}</small></span></div></td>
                    <td><StatusPill tone={state.tone}>{state.label}</StatusPill></td>
                    <td><span className="portion-value">{trip.plannedQuantity} porsi</span></td>
                    <td><span className="eta-value">{trip.status === "COMPLETED" ? "Selesai" : trip.status === "CANCELLED" ? "—" : formatClock(trip.plannedArrivalAt)}</span></td>
                    <td><button className="row-menu" aria-label={`Opsi TRP-${trip.id.slice(0, 8)}`}><MoreHorizontal size={17} /></button></td>
                  </tr>
                );
              })}
              {!trips.length && <tr><td colSpan={6} style={{ height: 88, color: "#8a97a7", textAlign: "center" }}>Belum ada perjalanan hari ini.</td></tr>}
              </tbody></table></div>
              <Link className="mobile-all-link" href="/trips">Lihat semua perjalanan<ArrowRight size={14} /></Link>
            </div>

            {showAlerts && canReadExceptions && <aside className="panel alert-panel"><div className="panel-heading"><div><div className="section-title-row"><h2>Perlu perhatian</h2><span className="alert-count">{activeExceptions.length}</span></div><p>Prioritas tindak lanjut operasional</p></div><button className="square-button small-square" aria-label="Filter alert"><Filter size={15} /></button></div><div className="alert-list">{activeExceptions.slice(0, 3).map((exception) => {
              const level = exceptionLevel(exception);
              const Icon = exception.severity === "CRITICAL" ? AlertTriangle : exception.severity === "HIGH" ? Clock3 : ShieldCheck;
              return (
                <article className="alert-row" key={exception.id}>
                  <span className={`alert-icon alert-${level.tone}`}><Icon size={16} /></span>
                  <div className="alert-copy"><strong>{exception.title}</strong><span>{exception.sppg.name} · {relativeTime(exception.openedAt)}</span></div>
                  <StatusPill tone={level.tone}>{level.label}</StatusPill>
                </article>
              );
            })}
            {!activeExceptions.length && <p style={{ padding: "18px 2px", color: "#8a97a7", fontSize: 9 }}>Tidak ada exception aktif.</p>}
            </div><Link className="alert-footer" href="/exceptions">Buka pusat risiko<ArrowRight size={14} /></Link></aside>}
          </section>
          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-heading"><h2>Tautan Cepat</h2><p>Akses halaman yang tidak ada di menu platform utama.</p></div>
            <div className="app-link-row" style={{ padding: '0 16px 16px' }}>
              <Link href="/register" className="app-link-card"><FilePlus size={20} /><span>Pendaftaran SPPG</span></Link>
              <Link href="/register/status" className="app-link-card"><ClipboardCheck size={20} /><span>Status Pendaftaran</span></Link>
              <Link href="/acceptinvitation" className="app-link-card"><KeyRound size={20} /><span>Aktivasi Akun</span></Link>
              <Link href="/reporting" className="app-link-card"><BarChart3 size={20} /><span>Laporan</span></Link>
              <Link href="/tenant" className="app-link-card"><Building2 size={20} /><span>Workspace Tenant</span></Link>
            </div>
          </section>
          <footer className="page-footer"><span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional</span><span>Zona waktu Asia/Jakarta <i>·</i> Dimuat {formatClock(dashboard.refreshedAt)} WIB</span></footer>
        </div>
      </section>
    </main>
  );
}
