"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { HeaderAccount } from "@/components/account-menu";
import { AppSidebar } from "@/components/app-sidebar";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  createTrip,
  getCurrentSession,
  getSessionRole,
  getSppgOptions,
  getTripResourceOptions,
  getTrips,
  hasPermission,
  type Paginated,
  type SessionUser,
  type SppgSummary,
  type TripResourceOptions,
  type TripSummary,
} from "@/lib/api";

const PAGE_SIZE = 25;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

type TripFormState = {
  sppgId: string;
  deliveryLocationId: string;
  vehicleId: string;
  driverId: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  plannedQuantity: string;
};

function toWibInput(date: Date) {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

function wibInputToIso(value: string) {
  const parsed = new Date(`${value}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function defaultTripForm(): TripFormState {
  const departure = new Date(Date.now() + 30 * 60_000);
  departure.setUTCSeconds(0, 0);
  departure.setUTCMinutes(Math.ceil(departure.getUTCMinutes() / 15) * 15);
  const arrival = new Date(departure.getTime() + 2 * 60 * 60_000);
  return {
    sppgId: "",
    deliveryLocationId: "",
    vehicleId: "",
    driverId: "",
    plannedDepartureAt: toWibInput(departure),
    plannedArrivalAt: toWibInput(arrival),
    plannedQuantity: "",
  };
}

function createTripErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "SPPG_NOT_ACTIVE":
      return "SPPG tidak aktif atau berada di luar scope akses.";
    case "INVALID_DESTINATION":
      return "Lokasi tujuan tidak valid untuk organisasi SPPG ini.";
    case "VEHICLE_NOT_AVAILABLE":
      return "Kendaraan tidak aktif atau bukan milik SPPG yang dipilih.";
    case "DRIVER_NOT_AVAILABLE":
      return "Pengemudi tidak aktif atau bukan milik SPPG yang dipilih.";
    case "RESOURCE_ALREADY_ASSIGNED":
      return "Kendaraan atau pengemudi sudah dipakai pada rentang waktu tersebut.";
    case "RESOURCE_ASSIGNMENT_CONFLICT_RETRY":
      return "Terjadi bentrok penugasan bersamaan. Coba lagi.";
    case "INVALID_TRIP_SCHEDULE":
      return "Waktu tiba harus setelah waktu berangkat.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk membuat perjalanan.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    default:
      return "Perjalanan gagal dibuat. Periksa data lalu coba lagi.";
  }
}

const statusOptions = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draf" },
  { value: "SCHEDULED", label: "Terjadwal" },
  { value: "READY_TO_DEPART", label: "Siap berangkat" },
  { value: "IN_TRANSIT", label: "Dalam perjalanan" },
  { value: "ARRIVAL_DETECTED", label: "Kedatangan terdeteksi" },
  { value: "ARRIVAL_VERIFIED", label: "Kedatangan terverifikasi" },
  { value: "DELIVERY_IN_PROGRESS", label: "Penyaluran berlangsung" },
  { value: "DELIVERED", label: "Terkirim" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
  { value: "EXCEPTION", label: "Perlu perhatian" },
];

const trackingLabels: Record<string, string> = {
  LIVE: "Sinyal aktif",
  STALE: "Data tertunda",
  OFFLINE: "Tidak ada sinyal",
  GPS_UNAVAILABLE: "GPS tidak tersedia",
  ENDED: "Tracking berakhir",
};

function tripState(status: string): { label: string; tone: string } {
  switch (status) {
    case "COMPLETED":
      return { label: "Selesai", tone: "green" };
    case "DELIVERED":
      return { label: "Terkirim, menunggu review", tone: "green" };
    case "DELIVERY_IN_PROGRESS":
      return { label: "Penyaluran berlangsung", tone: "violet" };
    case "ARRIVAL_VERIFIED":
      return { label: "Tiba terverifikasi", tone: "green" };
    case "ARRIVAL_DETECTED":
      return { label: "Tiba, menunggu verifikasi", tone: "violet" };
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
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
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function TripsPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [data, setData] = useState<Paginated<TripSummary> | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sppgOptions, setSppgOptions] = useState<SppgSummary[] | null>(null);
  const [optionsState, setOptionsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [resources, setResources] = useState<TripResourceOptions | null>(null);
  const [resourceState, setResourceState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const resourceRequestRef = useRef(0);
  const [form, setForm] = useState<TripFormState>({
    sppgId: "",
    deliveryLocationId: "",
    vehicleId: "",
    driverId: "",
    plannedDepartureAt: "",
    plannedArrivalAt: "",
    plannedQuantity: "",
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim();
      setSearchTerm((current) => (current === next ? current : next));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(false);

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
        setLoading(false);
        return;
      }
      if (!active) return;
      setSessionUser(user);
      setSessionState("ready");
      if (!hasPermission(user, "trip:read")) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      try {
        const result = await getTrips({
          status: status || undefined,
          q: searchTerm || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!active) return;
        setData(result);
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        if (error instanceof Error && error.message === "REQUEST_FAILED_403") {
          setForbidden(true);
          return;
        }
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [page, reloadKey, router, searchTerm, status]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!createOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !createBusy) {
        setCreateOpen(false);
        setCreateError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createBusy, createOpen]);

  async function loadResources(sppgId: string) {
    const requestId = ++resourceRequestRef.current;
    if (!sppgId) {
      setResources(null);
      setResourceState("idle");
      return;
    }
    setResources(null);
    setResourceState("loading");
    try {
      const result = await getTripResourceOptions(sppgId);
      if (requestId !== resourceRequestRef.current) return;
      setResources(result);
      setResourceState("ready");
    } catch (error: unknown) {
      if (requestId !== resourceRequestRef.current) return;
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setResourceState("error");
    }
  }

  async function loadCreateOptions() {
    resourceRequestRef.current += 1;
    setOptionsState("loading");
    setResources(null);
    setResourceState("idle");
    try {
      const result = await getSppgOptions();
      setSppgOptions(result);
      setOptionsState("ready");
      const firstSppg = result.find((sppg) => sppg.status === "ACTIVE") ?? null;
      setForm((current) => ({ ...current, sppgId: firstSppg?.id ?? "" }));
      if (firstSppg) {
        await loadResources(firstSppg.id);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setOptionsState("error");
    }
  }

  function openCreate() {
    if (createBusy) return;
    setCreateOpen(true);
    setCreateError("");
    setForm(defaultTripForm());
    setResources(null);
    setResourceState("idle");
    if (optionsState !== "ready" || !sppgOptions) {
      void loadCreateOptions();
      return;
    }
    const firstSppg = sppgOptions.find((sppg) => sppg.status === "ACTIVE") ?? null;
    setForm((current) => ({ ...current, sppgId: firstSppg?.id ?? "" }));
    if (firstSppg) void loadResources(firstSppg.id);
  }

  function closeCreate() {
    if (createBusy) return;
    resourceRequestRef.current += 1;
    setCreateOpen(false);
    setCreateError("");
  }

  function updateField(field: keyof TripFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeSppg(value: string) {
    setForm((current) => ({
      ...current,
      sppgId: value,
      deliveryLocationId: "",
      vehicleId: "",
      driverId: "",
    }));
    void loadResources(value);
  }

  function changeDeparture(value: string) {
    setForm((current) => {
      const departure = wibInputToIso(value);
      const arrival = wibInputToIso(current.plannedArrivalAt);
      if (!departure || (arrival && new Date(arrival) > new Date(departure))) {
        return { ...current, plannedDepartureAt: value };
      }
      const nextArrival = new Date(new Date(departure).getTime() + 2 * 60 * 60_000);
      return {
        ...current,
        plannedDepartureAt: value,
        plannedArrivalAt: toWibInput(nextArrival),
      };
    });
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createBusy) return;
    setCreateError("");

    if (resourceState !== "ready") {
      setCreateError("Pilihan tujuan, kendaraan, dan pengemudi belum siap.");
      return;
    }
    if (!form.sppgId || !form.deliveryLocationId || !form.vehicleId || !form.driverId) {
      setCreateError("Lengkapi SPPG, tujuan, kendaraan, dan pengemudi.");
      return;
    }
    const plannedQuantity = Number(form.plannedQuantity);
    if (!Number.isInteger(plannedQuantity) || plannedQuantity < 1 || plannedQuantity > 100_000) {
      setCreateError("Jumlah porsi harus bilangan bulat 1-100.000.");
      return;
    }
    const plannedDepartureAt = wibInputToIso(form.plannedDepartureAt);
    const plannedArrivalAt = wibInputToIso(form.plannedArrivalAt);
    if (!plannedDepartureAt || !plannedArrivalAt) {
      setCreateError("Jadwal berangkat dan tiba wajib diisi.");
      return;
    }
    if (new Date(plannedArrivalAt) <= new Date(plannedDepartureAt)) {
      setCreateError("Waktu tiba harus setelah waktu berangkat.");
      return;
    }

    setCreateBusy(true);
    try {
      const result = await createTrip({
        sppgId: form.sppgId,
        deliveryLocationId: form.deliveryLocationId,
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        plannedDepartureAt,
        plannedArrivalAt,
        plannedQuantity,
      });
      setCreateOpen(false);
      setToast('Perjalanan berhasil dibuat.');
      router.push(`/trips/${result.trip.id}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setCreateError(createTripErrorMessage(error));
    } finally {
      setCreateBusy(false);
    }
  }

  function changeStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  if (sessionState === "checking") {
    return (
      <main className="session-state">
        <span className="session-spinner" />
        <p>Memuat daftar perjalanan...</p>
      </main>
    );
  }

  if (sessionState === "unavailable" || !sessionUser) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Layanan belum tersedia</h1>
        <p>Daftar perjalanan tidak dapat memverifikasi sesi. Pastikan API dan PostgreSQL aktif.</p>
        <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Akses terbatas</h1>
        <p>Peran <strong>{getSessionRole(sessionUser)}</strong> tidak memiliki izin membaca perjalanan. Hubungi administrator untuk penugasan role.</p>
        <button className="session-retry" onClick={() => router.replace("/")}>Kembali ke ringkasan</button>
      </main>
    );
  }

  const trips = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const activeCount = trips.filter((trip) =>
    ["READY_TO_DEPART", "IN_TRANSIT", "ARRIVAL_DETECTED", "ARRIVAL_VERIFIED", "DELIVERY_IN_PROGRESS"].includes(trip.status),
  ).length;
  const canCreateTrip = hasPermission(sessionUser, "trip:create") && hasPermission(sessionUser, "master:read");
  const completedCount = trips.filter((trip) => trip.status === "COMPLETED" || trip.status === "DELIVERED").length;
  const completionRate = trips.length === 0 ? 0 : Math.round((completedCount / trips.length) * 100);
  const activeSppgOptions = (sppgOptions ?? []).filter((sppg) => sppg.status === "ACTIVE");
  const selectedSppg = activeSppgOptions.find((sppg) => sppg.id === form.sppgId) ?? null;
  const destinationOptions = selectedSppg
    ? (resources?.deliveryLocations ?? []).filter(
        (location) => location.active && location.organizationId === selectedSppg.organizationId,
      )
    : [];
  const vehicleOptions = (resources?.vehicles ?? []).filter(
    (vehicle) => vehicle.status === "ACTIVE" && vehicle.sppgId === form.sppgId,
  );
  const driverOptions = (resources?.drivers ?? []).filter(
    (driver) => driver.status === "ACTIVE" && driver.sppgId === form.sppgId,
  );
  const resourcesReady = resourceState === "ready";

  return (
    <main className="app-shell">
      <Suspense fallback={<aside className="sidebar" />}>
        <AppSidebar />
      </Suspense>
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><strong>Perjalanan</strong></div>
          <div className="topbar-actions"><HeaderAccount user={sessionUser} /></div>
        </header>

        <div className="content-area">
        {toast && (
          <div className="toast toast-success" role="status">
            <CheckCircle2 size={16} />
            <span>{toast}</span>
            <button onClick={() => setToast(null)} aria-label="Tutup notifikasi"><X size={14} /></button>
          </div>
        )}
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />OPERASIONAL</div>
            <h1>Manajemen perjalanan</h1>
            <p>Pantau dan kelola pengiriman MBG sesuai scope akses Anda.</p>
          </div>
          <div className="page-actions">
            {canCreateTrip && (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={16} />
                Tambah perjalanan
              </button>
            )}
            <button className="btn" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={14} />
              {loading ? "Memuat..." : "Muat ulang"}
            </button>
          </div>
        </div>

        <div className="kpi-grid kpi-grid-4">
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-navy"><Route size={16} /></span>
              <span className="kpi-trend trend-up">{pagination ? `${pagination.page}/${Math.max(1, totalPages)}` : "—"}</span>
            </div>
            <div className="kpi-label">Total perjalanan</div>
            <div className="kpi-value">{pagination?.total ?? 0}</div>
            <div className="kpi-foot"><span className="kpi-dot blue-dot" />{searchTerm || status ? "Sesuai filter aktif" : "Seluruh perjalanan"}</div>
          </article>
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-blue"><Truck size={16} /></span>
            </div>
            <div className="kpi-label">Sedang berjalan</div>
            <div className="kpi-value">{activeCount}</div>
            <div className="kpi-foot"><span className="kpi-dot blue-dot" />Aktif di halaman ini</div>
          </article>
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-green"><CheckCircle2 size={16} /></span>
            </div>
            <div className="kpi-label">Selesai</div>
            <div className="kpi-value">{completedCount}</div>
            <div className="kpi-foot"><span className="kpi-dot blue-dot" />Selesai di halaman ini</div>
          </article>
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-amber"><Gauge size={16} /></span>
            </div>
            <div className="kpi-label">Tingkat penyelesaian</div>
            <div className="kpi-value">{completionRate}<span className="unit">%</span></div>
            <div className="kpi-foot">
              <span className="progress-track"><i style={{ width: `${completionRate}%` }} /></span>
              Dari trip di halaman ini
            </div>
          </article>
        </div>

        <section className="panel trips-toolbar">
          <div className="trips-filter">
            <div className="search-group">
              <Search size={14} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari rute, pengemudi, plat nomor, atau status"
                aria-label="Cari perjalanan"
                maxLength={100}
              />
            </div>
            <label className="trips-filter-label" htmlFor="trip-status">Status</label>
            <select
              id="trip-status"
              className="trip-filter-select"
              value={status}
              onChange={(event) => changeStatus(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {(query || status) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQuery("");
                  setSearchTerm("");
                  changeStatus("");
                }}
              >
                <X size={13} />
                Reset
              </button>
            )}
          </div>
          <div className="trips-toolbar-stats">
            <span><strong>{pagination?.total ?? 0}</strong> total</span>
            <span><strong>{activeCount}</strong> aktif di halaman ini</span>
            <span><strong>{pagination ? `${pagination.page}/${Math.max(1, totalPages)}` : "—"}</strong> halaman</span>
          </div>
        </section>

        <section className="panel trips-list-panel">
          <div className="panel-header">
            <div>
              <div className="section-title-row">
                <h2>Daftar perjalanan</h2>
                <span className="count-chip">{trips.length}</span>
              </div>
              <p>
                {status
                  ? `Filter: ${statusOptions.find((option) => option.value === status)?.label}`
                  : "Semua status"}
                {searchTerm ? ` · Pencarian: “${query.trim()}”` : ""}
              </p>
            </div>
            <div className="panel-actions">
              <span className="panel-meta">
                {pagination ? `${trips.length} dari ${pagination.total} trip` : "—"}
              </span>
            </div>
          </div>

          {loadError ? (
            <div className="empty-state">
              <AlertTriangle size={19} />
              <strong>Daftar perjalanan gagal dimuat</strong>
              <span>API tidak merespons atau sesi tidak lagi valid.</span>
              <button className="btn btn-sm" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button>
            </div>
          ) : loading && !data ? (
            <div className="empty-state"><span className="session-spinner" /><span>Memuat perjalanan...</span></div>
          ) : trips.length === 0 ? (
            <div className="empty-state">
              <Search size={19} />
              <strong>{searchTerm ? "Tidak ada hasil pencarian" : "Tidak ada perjalanan"}</strong>
              <span>
                {searchTerm
                  ? "Coba kata kunci lain atau reset filter."
                  : status
                    ? "Tidak ada trip dengan status ini."
                    : "Belum ada trip dalam scope akses Anda."}
              </span>
              {searchTerm && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setQuery("");
                    setSearchTerm("");
                  }}
                >
                  Hapus pencarian
                </button>
              )}
            </div>
          ) : (
            <div className={`table-wrapper ${loading ? "trips-table-loading" : ""}`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Rute</th>
                    <th>Pengemudi</th>
                    <th>Kendaraan</th>
                    <th>Porsi</th>
                    <th>Status</th>
                    <th>GPS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => {
                    const state = tripState(trip.status);
                    const position = trip.positions[0];
                    return (
                      <tr key={trip.id}>
                        <td>
                          <Link className="trip-id trip-detail-link" href={`/trips/${trip.id}`}>
                            TRP-{trip.id.slice(0, 8).toUpperCase()}
                          </Link>
                          <span className="table-sub">{formatDateTime(trip.plannedDepartureAt)}</span>
                        </td>
                        <td>
                          <div className="route-copy">
                            <strong>{trip.sppg.name} → {trip.deliveryLocation.name}</strong>
                            <small>{trip.deliveryLocation.code}</small>
                          </div>
                        </td>
                        <td>
                          <div className="driver-cell">
                            <span className="driver-avatar avatar-blue">{initials(trip.driver.name)}</span>
                            <span>{trip.driver.name}</span>
                          </div>
                        </td>
                        <td><span className="trips-vehicle">{trip.vehicle.plateNumber}</span></td>
                        <td><span className="portion-value">{trip.receivedQuantity ?? trip.dispatchedQuantity ?? trip.plannedQuantity} / {trip.plannedQuantity}</span></td>
                        <td><span className={`status-pill status-${state.tone}`}><span className="status-dot" />{state.label}</span></td>
                        <td>
                          <span className={`trips-gps trips-gps-${position ? trip.trackingStatus.toLowerCase() : "none"}`}>
                            <MapPin size={12} />
                            {position ? `${trackingLabels[trip.trackingStatus] ?? trip.trackingStatus} · ${relativeTime(position.serverReceivedAt)}` : "Belum ada posisi"}
                          </span>
                        </td>
                        <td>
                          <Link className="trips-detail-action" href={`/trips/${trip.id}`}>
                            Detail
                            <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="trips-pagination">
            <span>
              {pagination && pagination.total > 0
                ? `Menampilkan ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} dari ${pagination.total}`
                : "Tidak ada data"}
            </span>
            <div>
              <button
                className="btn btn-sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={loading || page <= 1}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={15} />
                Sebelumnya
              </button>
              <span className="trips-page-number">{page} / {Math.max(1, totalPages)}</span>
              <button
                className="btn btn-sm"
                onClick={() => setPage((value) => value + 1)}
                disabled={loading || totalPages === 0 || page >= totalPages}
                aria-label="Halaman berikutnya"
              >
                Berikutnya
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {createOpen && canCreateTrip && (
        <div
          className="trip-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreate();
          }}
        >
          <div className="trip-modal trip-create-modal" role="dialog" aria-modal="true" aria-labelledby="trip-create-title">
            <button className="trip-modal-close" onClick={closeCreate} disabled={createBusy} aria-label="Tutup dialog">
              <X size={17} />
            </button>
            <div className="trip-create-heading">
              <span className="trip-modal-icon primary"><CalendarClock size={19} /></span>
              <div>
                <h2 id="trip-create-title">Buat perjalanan</h2>
                <p>Draft trip mengikuti scope SPPG, kendaraan, dan pengemudi yang dipilih.</p>
              </div>
            </div>

            {(optionsState === "idle" || optionsState === "loading") && (
              <div className="trip-form-state">
                <span className="session-spinner" />
                <span>Memuat daftar SPPG...</span>
              </div>
            )}

            {optionsState === "error" && (
              <div className="trip-form-state">
                <AlertTriangle size={18} />
                <strong>Master data gagal dimuat</strong>
                <span>Periksa koneksi API atau izin `master:read`, lalu coba lagi.</span>
                <div className="trip-modal-actions">
                  <button className="trip-action-button muted" onClick={closeCreate}>Kembali</button>
                  <button className="trip-action-button primary" onClick={() => void loadCreateOptions()}>Muat ulang data</button>
                </div>
              </div>
            )}

            {optionsState === "ready" && (
              <form className="trip-create-form" onSubmit={submitCreate}>
                {activeSppgOptions.length === 0 ? (
                  <div className="trip-form-empty">
                    <AlertTriangle size={16} />
                    <span>Tidak ada SPPG aktif dalam scope akses Anda. Hubungi admin master data.</span>
                  </div>
                ) : (
                  <>
                    <label className="trip-form-field" htmlFor="trip-create-sppg">
                      <span>SPPG asal</span>
                      <select
                        id="trip-create-sppg"
                        value={form.sppgId}
                        onChange={(event) => changeSppg(event.target.value)}
                        disabled={createBusy}
                      >
                        <option value="">Pilih SPPG</option>
                        {activeSppgOptions.map((sppg) => (
                          <option key={sppg.id} value={sppg.id}>{sppg.code} · {sppg.name}</option>
                        ))}
                      </select>
                    </label>

                    {resourceState === "loading" && (
                      <div className="trip-inline-state">
                        <span className="session-spinner" />
                        <span>Memuat tujuan, kendaraan, dan pengemudi untuk SPPG ini...</span>
                      </div>
                    )}
                    {resourceState === "error" && (
                      <div className="trip-inline-state error">
                        <AlertTriangle size={14} />
                        <span>Pilihan untuk SPPG ini gagal dimuat.</span>
                        <button type="button" onClick={() => void loadResources(form.sppgId)} disabled={!form.sppgId}>
                          Coba lagi
                        </button>
                      </div>
                    )}

                    <label className="trip-form-field" htmlFor="trip-create-destination">
                      <span>Tujuan pengiriman</span>
                      <select
                        id="trip-create-destination"
                        value={form.deliveryLocationId}
                        onChange={(event) => updateField("deliveryLocationId", event.target.value)}
                        disabled={createBusy || !selectedSppg || !resourcesReady}
                      >
                        <option value="">
                          {!selectedSppg ? "Pilih SPPG terlebih dahulu" : resourcesReady ? "Pilih tujuan" : "Memuat tujuan..."}
                        </option>
                        {destinationOptions.map((location) => (
                          <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                        ))}
                      </select>
                      {resourcesReady && selectedSppg && destinationOptions.length === 0 && (
                        <small>Tidak ada tujuan aktif untuk organisasi SPPG ini.</small>
                      )}
                    </label>

                    <div className="trip-form-grid">
                      <label className="trip-form-field" htmlFor="trip-create-vehicle">
                        <span><Truck size={12} />Kendaraan</span>
                        <select
                          id="trip-create-vehicle"
                          value={form.vehicleId}
                          onChange={(event) => updateField("vehicleId", event.target.value)}
                          disabled={createBusy || !selectedSppg || !resourcesReady}
                        >
                          <option value="">
                            {!selectedSppg ? "Pilih SPPG terlebih dahulu" : resourcesReady ? "Pilih kendaraan" : "Memuat kendaraan..."}
                          </option>
                          {vehicleOptions.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.plateNumber}{vehicle.label ? ` · ${vehicle.label}` : ""}{vehicle.capacity ? ` · ${vehicle.capacity} porsi` : ""}
                            </option>
                          ))}
                        </select>
                        {resourcesReady && selectedSppg && vehicleOptions.length === 0 && (
                          <small>Tidak ada kendaraan aktif untuk SPPG ini.</small>
                        )}
                      </label>

                      <label className="trip-form-field" htmlFor="trip-create-driver">
                        <span><UserRound size={12} />Pengemudi</span>
                        <select
                          id="trip-create-driver"
                          value={form.driverId}
                          onChange={(event) => updateField("driverId", event.target.value)}
                          disabled={createBusy || !selectedSppg || !resourcesReady}
                        >
                          <option value="">
                            {!selectedSppg ? "Pilih SPPG terlebih dahulu" : resourcesReady ? "Pilih pengemudi" : "Memuat pengemudi..."}
                          </option>
                          {driverOptions.map((driver) => (
                            <option key={driver.id} value={driver.id}>{driver.code} · {driver.name}</option>
                          ))}
                        </select>
                        {resourcesReady && selectedSppg && driverOptions.length === 0 && (
                          <small>Tidak ada pengemudi aktif untuk SPPG ini.</small>
                        )}
                      </label>
                    </div>

                    <div className="trip-form-grid">
                      <label className="trip-form-field" htmlFor="trip-create-departure">
                        <span><CalendarClock size={12} />Berangkat (WIB)</span>
                        <input
                          id="trip-create-departure"
                          type="datetime-local"
                          value={form.plannedDepartureAt}
                          onChange={(event) => changeDeparture(event.target.value)}
                          disabled={createBusy}
                        />
                      </label>
                      <label className="trip-form-field" htmlFor="trip-create-arrival">
                        <span><CalendarClock size={12} />Tiba (WIB)</span>
                        <input
                          id="trip-create-arrival"
                          type="datetime-local"
                          value={form.plannedArrivalAt}
                          onChange={(event) => updateField("plannedArrivalAt", event.target.value)}
                          disabled={createBusy}
                        />
                      </label>
                    </div>

                    <label className="trip-form-field" htmlFor="trip-create-quantity">
                      <span>Rencana porsi</span>
                      <input
                        id="trip-create-quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100000}
                        step={1}
                        value={form.plannedQuantity}
                        onChange={(event) => updateField("plannedQuantity", event.target.value)}
                        placeholder="Contoh: 250"
                        disabled={createBusy}
                      />
                      <small>Jumlah porsi yang direncanakan untuk trip ini.</small>
                    </label>
                  </>
                )}

                {createError && (
                  <div className="trip-modal-error" role="alert">
                    <AlertTriangle size={14} />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="trip-modal-actions">
                  <button type="button" className="trip-action-button muted" onClick={closeCreate} disabled={createBusy}>Kembali</button>
                  <button
                    type="submit"
                    className="trip-action-button primary"
                    disabled={createBusy || activeSppgOptions.length === 0 || !resourcesReady}
                  >
                    {createBusy ? "Membuat..." : "Buat draft trip"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      </section>
    </main>
  );
}
