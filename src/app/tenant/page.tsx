"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  ChevronRight,
  Map as MapIcon,
  Navigation,
  PackageCheck,
  Printer,
  Radio,
  RefreshCw,
  Truck,
  Users,
  X,
} from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { FleetMap } from "@/components/fleet-map";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser, type TripSummary } from "@/lib/api";

type TenantSummary = {
  drivers: number;
  vehicles: number;
  tripsToday: number;
  tripsActive: number;
  tripsDone: number;
};

type TenantMe = {
  id: string;
  tenantCode: string;
  name: string;
  status: string;
  profile?: {
    sppgName: string;
    fullAddress: string;
    contactPhone: string;
  } | null;
};

type TenantTrip = {
  id: string;
  status: string;
  trackingStatus: string;
  verificationStatus: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  plannedQuantity: number;
  vehicle: { plateNumber: string } | null;
  driver: { name: string } | null;
  deliveryLocation: { name: string } | null;
  sppg: { name: string } | null;
  positions: Array<{
    latitude: string | number;
    longitude: string | number;
    serverReceivedAt: string;
    accuracyMeters: string | number | null;
  }>;
};

type MapFilter = "all" | "active" | "attention" | "stale" | "verified";

const MAP_FILTERS: Array<{ value: MapFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Dalam perjalanan" },
  { value: "attention", label: "Perlu perhatian" },
  { value: "stale", label: "GPS usang" },
  { value: "verified", label: "Terverifikasi" },
];

const activeTripStatuses = new Set([
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
]);

function formatClock(value: string | null | undefined) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "--:--";
  const parts = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "--";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "--";
  return `${hour}:${minute}`;
}

function tripNeedsAttention(trip: TenantTrip, now: number) {
  const gpsNeedsAttention = ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(trip.trackingStatus);
  const isLate = activeTripStatuses.has(trip.status) && new Date(trip.plannedArrivalAt).getTime() < now;
  return trip.status === "EXCEPTION" || gpsNeedsAttention || isLate;
}

function matchesMapFilter(trip: TenantTrip, filter: MapFilter, now: number) {
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

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function tripStateLabel(status: string): { label: string; tone: string } {
  switch (status) {
    case "COMPLETED": return { label: "Selesai", tone: "green" };
    case "DELIVERED": return { label: "Terkirim", tone: "green" };
    case "DELIVERY_IN_PROGRESS": return { label: "Penyaluran", tone: "violet" };
    case "ARRIVAL_VERIFIED": return { label: "Tiba terverifikasi", tone: "green" };
    case "ARRIVAL_DETECTED": return { label: "Tiba", tone: "violet" };
    case "IN_TRANSIT": return { label: "Dalam perjalanan", tone: "blue" };
    case "READY_TO_DEPART": return { label: "Siap berangkat", tone: "amber" };
    case "SCHEDULED": return { label: "Terjadwal", tone: "blue" };
    case "CANCELLED": return { label: "Dibatalkan", tone: "red" };
    case "EXCEPTION": return { label: "Perlu perhatian", tone: "red" };
    default: return { label: "Draf", tone: "blue" };
  }
}

export default function TenantPage() {
  const router = useRouter();
  const mapSectionRef = useRef<HTMLElement>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [me, setMe] = useState<TenantMe | null>(null);
  const [trips, setTrips] = useState<TenantTrip[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [selectedMapTripId, setSelectedMapTripId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const loadSummary = useCallback(async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const [summaryRes, meRes, tripsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/tenant/summary`, { credentials: "include" }),
        fetch(`${apiBaseUrl}/tenant/me`, { credentials: "include" }),
        fetch(`${apiBaseUrl}/tenant/trips`, { credentials: "include" }),
      ]);
      if (!summaryRes.ok || !meRes.ok) throw new Error("Gagal memuat data tenant");
      const [summaryData, meData, tripsData] = await Promise.all([summaryRes.json(), meRes.json(), tripsRes.json()]);
      setSummary(summaryData);
      setMe(meData);
      setTrips(Array.isArray(tripsData) ? tripsData : tripsData.data ?? []);
      setSessionState("ready");
      setRefreshError(null);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      if (silent) {
        setRefreshError("Pembaruan otomatis gagal. Data terakhir tetap ditampilkan.");
      } else {
        setSessionState("data-error");
      }
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await getCurrentSession();
        if (!active) return;
        if (user.tenantRole !== "TENANT_ADMIN" && user.tenantRole !== "SUPERADMIN") {
          router.replace(user.tenantRole === "TENANT_DRIVER" ? "/radarapp" : "/login");
          return;
        }
        setSessionUser(user);
        await loadSummary(false);
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setSessionState("unavailable");
      }
    })();
    return () => { active = false; };
  }, [router, loadSummary]);

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

  const handleRefresh = useCallback(async (silent = true) => {
    if (!sessionUser) return;
    setRefreshing(true);
    try {
      await loadSummary(silent);
    } finally {
      setRefreshing(false);
    }
  }, [sessionUser, loadSummary]);

  useEffect(() => {
    if (!sessionUser || sessionState !== "ready") return;
    const interval = window.setInterval(() => { void handleRefresh(true); }, 60_000);
    return () => window.clearInterval(interval);
  }, [sessionUser, sessionState, handleRefresh]);

  if (sessionState === "checking") {
    return <main className="session-state"><span className="session-spinner" /><p>Memuat data tenant…</p></main>;
  }

  if (sessionState === "unavailable" || !sessionUser) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>Dashboard tidak dapat memverifikasi sesi. Pastikan API dan PostgreSQL aktif.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  if (sessionState === "data-error" || !summary) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Data tenant gagal dimuat</h1><p>Sesi valid, tetapi API tidak merespons. Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  }

  const canReadTrips = hasPermission(sessionUser, "trip:read");
  const canManageUsers = hasPermission(sessionUser, "admin:manage_users");

  const locatedTrips = trips.filter((t) => t.positions?.length > 0);
  const dashboardNow = Date.now();
  const mapTrips = locatedTrips.filter((t) => matchesMapFilter(t, mapFilter, dashboardNow));
  const selectedMapTrip = mapTrips.find((t) => t.id === selectedMapTripId) ?? null;
  const selectedPosition = selectedMapTrip?.positions?.[0] ?? null;
  const staleGpsTrips = locatedTrips.filter((t) => ["STALE", "OFFLINE", "GPS_UNAVAILABLE"].includes(t.trackingStatus));
  const latestPositionAt = locatedTrips.reduce<string | null>((latest, trip) => {
    const received = trip.positions?.[0]?.serverReceivedAt ?? null;
    if (!received) return latest;
    return !latest || new Date(received) > new Date(latest) ? received : latest;
  }, null);
  const freshnessStale = !latestPositionAt || Date.now() - new Date(latestPositionAt).getTime() > 10 * 60_000;

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Ringkasan</strong></div>
          <div className="topbar-actions">
            <span className="environment"><span className="live-dot" />DATA OPERASIONAL</span>
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
              <p>Gambaran operasional tenant dari data RADAR MBG.</p>
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
            <span><strong>Data operasional</strong> — diperbarui otomatis. Terakhir dimuat {formatClock(new Date().toISOString())} WIB.</span>
            {refreshError && (
              <button type="button" onClick={() => setRefreshError(null)} aria-label="Tutup peringatan pembaruan">
                <X size={14} />
              </button>
            )}
          </div>
          {refreshError && <p className="refresh-warning" role="status">{refreshError}</p>}

          {me && (
            <section className="panel" aria-label="Info tenant">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>{me.name}</h2><span className="count-chip">{me.tenantCode}</span></div>
                  <p>{me.profile?.sppgName} · {me.profile?.fullAddress}</p>
                </div>
              </div>
            </section>
          )}

          <section className={`kpi-grid kpi-grid-4`} aria-label="Ringkasan operasional">
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-blue"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Hari ini</span></div>
              <p className="kpi-label">Perjalanan hari ini</p>
              <div className="kpi-value">{summary.tripsToday} <span>perjalanan</span></div>
              <div className="kpi-foot"><span className="kpi-dot blue-dot" />{summary.tripsActive} aktif <span className="kpi-separator">·</span> {summary.tripsDone} selesai</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-green"><PackageCheck size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
              <p className="kpi-label">Perjalanan aktif</p>
              <div className="kpi-value">{summary.tripsActive} <span>perjalanan</span></div>
              <div className="kpi-foot">Dalam perjalanan / penyaluran</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-navy"><Users size={17} /></span><span className="kpi-trend trend-neutral">Master</span></div>
              <p className="kpi-label">Driver aktif</p>
              <div className="kpi-value">{summary.drivers} <span>driver</span></div>
              <div className="kpi-foot">Terdaftar di tenant ini</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-amber"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Master</span></div>
              <p className="kpi-label">Kendaraan aktif</p>
              <div className="kpi-value">{summary.vehicles} <span>kendaraan</span></div>
              <div className="kpi-foot">Terdaftar di tenant ini</div>
            </article>
          </section>

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
                    trips={mapTrips as unknown as TripSummary[]}
                    selectedTripId={selectedMapTripId}
                    onSelectTrip={(trip) => setSelectedMapTripId(trip.id)}
                    emptyMessage={locatedTrips.length && mapFilter !== "all" ? "Tidak ada perjalanan sesuai filter peta." : undefined}
                    expanded={mapExpanded}
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
                </div>
              </div>
              {selectedMapTrip && selectedPosition && (
                <article className="map-selection-panel" aria-live="polite">
                  <div className="map-selection-heading">
                    <div>
                      <span className="map-selection-eyebrow">DETAIL MARKER TERPILIH</span>
                      <strong>{selectedMapTrip.vehicle?.plateNumber ?? "—"} · {selectedMapTrip.driver?.name ?? "—"}</strong>
                      <small>{selectedMapTrip.sppg?.name ?? "—"} → {selectedMapTrip.deliveryLocation?.name ?? "—"}</small>
                    </div>
                    <span className={`status-pill status-${tripStateLabel(selectedMapTrip.status).tone}`}><span className="status-dot" />{tripStateLabel(selectedMapTrip.status).label}</span>
                  </div>
                  <div className="map-selection-meta">
                    <span><strong>GPS {trackingLabel(selectedMapTrip.trackingStatus)}</strong><small>{relativeTime(selectedPosition.serverReceivedAt)} · {formatClock(selectedPosition.serverReceivedAt)} WIB</small></span>
                    <span><strong>Koordinat WGS84</strong><small>{formatCoordinate(selectedPosition.latitude)}, {formatCoordinate(selectedPosition.longitude)}</small></span>
                    <span><strong>Akurasi</strong><small>{selectedPosition.accuracyMeters === null ? "Tidak tersedia" : `${Number(selectedPosition.accuracyMeters).toFixed(0)} m`}</small></span>
                  </div>
                  <Link className="map-selection-link" href={`/tenant/trips`}>Buka detail perjalanan<ArrowRight size={14} /></Link>
                </article>
              )}
            </section>

            <section className="panel alert-panel" aria-label="Aksi cepat">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Aksi cepat</h2></div>
                  <p>Pintasan tugas operasional tenant.</p>
                </div>
              </div>
              <div className="app-link-row">
                {canReadTrips && <Link href="/tenant/trips" className="app-link-card"><Navigation size={20} /><span>Perjalanan</span></Link>}
                <Link href="/tenant/drivers" className="app-link-card"><Users size={20} /><span>Driver</span></Link>
                <Link href="/tenant/vehicles" className="app-link-card"><Truck size={20} /><span>Kendaraan</span></Link>
                {canManageUsers && <Link href="/tenant/users" className="app-link-card"><Users size={20} /><span>Pengguna</span></Link>}
                <Link href="/tenant/audit" className="app-link-card"><Activity size={20} /><span>Audit</span></Link>
                <Link href="/tenant/profile" className="app-link-card"><Building2 size={20} /><span>Profil SPPG</span></Link>
              </div>
            </section>
          </div>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> Dimuat {formatClock(new Date().toISOString())} WIB</span>
          </footer>
        </main>
      </section>
    </div>
  );
}