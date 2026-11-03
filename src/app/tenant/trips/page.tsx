"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Navigation, Plus, RefreshCw, Truck, UserRound, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import {
  apiBaseUrl,
  createTenantTrip,
  getCurrentSession,
  hasPermission,
  type SessionUser,
} from "@/lib/api";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

type Trip = {
  id: string;
  status: string;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  plannedQuantity?: number;
  vehicle: { plateNumber: string } | null;
  driver: { name: string } | null;
  deliveryLocation: { name: string } | null;
};

type TripFormState = {
  deliveryLocationId: string;
  vehicleId: string;
  driverId: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  plannedQuantity: string;
};

type DriverOption = { id: string; code: string; name: string };
type VehicleOption = { id: string; plateNumber: string; label?: string | null };
type DeliveryLocationOption = { id: string; code: string; name: string };

function toWibInput(date: Date) {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

function wibInputToIso(value: string) {
  const parsed = new Date(`${value}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function createTripErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "SPPG_NOT_RESOLVED":
      return "SPPG untuk akun ini belum dapat ditentukan. Hubungi administrator platform agar akun terhubung ke SPPG.";
    case "VEHICLE_NOT_AVAILABLE":
      return "Kendaraan tidak aktif atau bukan milik tenant.";
    case "DRIVER_NOT_AVAILABLE":
      return "Pengemudi tidak aktif atau bukan milik tenant.";
    case "INVALID_DESTINATION":
      return "Lokasi tujuan tidak valid.";
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

function tripState(status: string): { label: string; tone: string } {
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

export default function TenantTripsPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable" | "data-error">("checking");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TripFormState>({ deliveryLocationId: "", vehicleId: "", driverId: "", plannedDepartureAt: "", plannedArrivalAt: "", plannedQuantity: "" });
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocationOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const departure = new Date(Date.now() + 30 * 60_000);
    departure.setUTCSeconds(0, 0);
    departure.setUTCMinutes(Math.ceil(departure.getUTCMinutes() / 15) * 15);
    const arrival = new Date(departure.getTime() + 2 * 60 * 60_000);
    setForm({
      deliveryLocationId: "",
      vehicleId: "",
      driverId: "",
      plannedDepartureAt: toWibInput(departure),
      plannedArrivalAt: toWibInput(arrival),
      plannedQuantity: "",
    });
  }, []);

  const loadTrips = async (silent: boolean) => {
    if (!silent) setSessionState("checking");
    try {
      const res = await fetch(`${apiBaseUrl}/tenant/trips`, { credentials: "include" });
      if (!res.ok) throw new Error("Gagal memuat perjalanan");
      const data = await res.json();
      setTrips(Array.isArray(data) ? data : data.data ?? []);
      setSessionState("ready");
      setRefreshError(null);
    } catch {
      if (silent) setRefreshError("Pembaruan gagal. Data terakhir tetap ditampilkan.");
      else setSessionState("data-error");
    }
  };

  const loadResources = async () => {
    try {
      const [driversRes, vehiclesRes, locsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/tenant/drivers`, { credentials: "include" }),
        fetch(`${apiBaseUrl}/tenant/vehicles`, { credentials: "include" }),
        fetch(`${apiBaseUrl}/tenant/delivery-locations`, { credentials: "include" }),
      ]);
      if (driversRes.ok) {
        const d = await driversRes.json();
        setDrivers(Array.isArray(d) ? d : d.data ?? []);
      }
      if (vehiclesRes.ok) {
        const v = await vehiclesRes.json();
        setVehicles(Array.isArray(v) ? v : v.data ?? []);
      }
      if (locsRes.ok) {
        const l = await locsRes.json();
        setDeliveryLocations(Array.isArray(l) ? l : l.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const user = await getCurrentSession();
        if (!active) return;
        setSessionUser(user);
        await loadTrips(false);
        await loadResources();
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "";
        if (message === "UNAUTHENTICATED" || message === "REQUEST_FAILED_403") {
          window.location.href = "/login";
          return;
        }
        setSessionState("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  const handleRefresh = async (silent = true) => {
    setRefreshing(true);
    try { await loadTrips(silent); } finally { setRefreshing(false); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const plannedDepartureAt = wibInputToIso(form.plannedDepartureAt);
      const plannedArrivalAt = wibInputToIso(form.plannedArrivalAt);
      if (!plannedDepartureAt || !plannedArrivalAt) throw new Error("INVALID_TRIP_SCHEDULE");
      await createTenantTrip({
        deliveryLocationId: form.deliveryLocationId,
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        plannedDepartureAt,
        plannedArrivalAt,
        plannedQuantity: Number(form.plannedQuantity) || 0,
      });
      setShowForm(false);
      setForm({ deliveryLocationId: "", vehicleId: "", driverId: "", plannedDepartureAt: "", plannedArrivalAt: "", plannedQuantity: "" });
      await loadTrips(true);
    } catch (err) {
      setFormError(createTripErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === "checking") return <main className="session-state"><span className="session-spinner" /><p>Memuat perjalanan…</p></main>;
  if (sessionState === "unavailable" || !sessionUser) return <main className="session-state"><span className="session-error-mark">!</span><h1>Sesi tidak dapat diverifikasi</h1><p>Silakan masuk kembali untuk mengakses halaman ini.</p><Link className="session-retry" href="/login">Masuk</Link></main>;
  if (sessionState === "data-error") return <main className="session-state"><span className="session-error-mark">!</span><h1>Data gagal dimuat</h1><p>Periksa koneksi API lalu coba lagi.</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;

  const canReadTrips = hasPermission(sessionUser, "trip:read");
  const canCreateTrip = hasPermission(sessionUser, "trip:create");

  return (
    <div className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Perjalanan</strong></div>
          <div className="topbar-actions">
            <span className="environment"><span className="live-dot" />DATA OPERASIONAL</span>
            <span className="topbar-divider" />
            <HeaderAccount user={sessionUser} />
          </div>
        </header>
        <main className="content-area dashboard-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()).toUpperCase()}</div>
              <h1>Perjalanan Tenant</h1>
              <p>Daftar perjalanan operasional SPPG.</p>
            </div>
            <div className="page-heading-actions">
              {canCreateTrip && (
                <button className="trip-create-trigger" onClick={() => setShowForm(true)}>
                  <Plus size={14} />
                  Buat perjalanan
                </button>
              )}
              <button className="export-button" onClick={() => void handleRefresh(true)} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
                {refreshing ? "Memuat…" : "Muat ulang"}
              </button>
            </div>
          </div>

          {refreshError && <p className="refresh-warning" role="status">{refreshError}</p>}

          {/* KPI Cards */}
          <section className="kpi-grid kpi-grid-4" aria-label="Ringkasan perjalanan" style={{ marginBottom: "1rem" }}>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-blue"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Total</span></div>
              <p className="kpi-label">Total Perjalanan</p>
              <div className="kpi-value">{trips.length} <span>trip</span></div>
              <div className="kpi-foot">Termuat</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-green"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Aktif</span></div>
              <p className="kpi-label">Perjalanan Aktif</p>
              <div className="kpi-value">{trips.filter((t) => ["IN_TRANSIT", "DELIVERY_IN_PROGRESS", "ARRIVAL_DETECTED", "ARRIVAL_VERIFIED"].includes(t.status)).length} <span>trip</span></div>
              <div className="kpi-foot">Dalam perjalanan / penyaluran</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-navy"><UserRound size={17} /></span><span className="kpi-trend trend-neutral">Selesai</span></div>
              <p className="kpi-label">Perjalanan Selesai</p>
              <div className="kpi-value">{trips.filter((t) => t.status === "COMPLETED").length} <span>trip</span></div>
              <div className="kpi-foot">Telah diselesaikan</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top"><span className="kpi-icon icon-amber"><Truck size={17} /></span><span className="kpi-trend trend-neutral">Terjadwal</span></div>
              <p className="kpi-label">Perjalanan Terjadwal</p>
              <div className="kpi-value">{trips.filter((t) => t.status === "SCHEDULED" || t.status === "READY_TO_DEPART").length} <span>trip</span></div>
              <div className="kpi-foot">Menunggu keberangkatan</div>
            </article>
          </section>

          {showForm && (
            <div className="trip-modal-backdrop" onClick={() => !submitting && setShowForm(false)}>
              <div className="trip-modal trip-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="trip-create-title">
                <button className="trip-modal-close" onClick={() => setShowForm(false)} disabled={submitting} aria-label="Tutup">
                  <X size={16} />
                </button>
                <div className="trip-create-heading">
                  <div className="trip-modal-icon primary">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h2 id="trip-create-title">Buat perjalanan baru</h2>
                    <p>Lengkapi data perjalanan operasional untuk tenant ini.</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="trip-create-form">
                  <div className="trip-form-grid">
                    <div className="trip-form-field">
                      <span>
                        <Truck size={12} />
                        Kendaraan
                      </span>
                      <select value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))} required>
                        <option value="">Pilih kendaraan</option>
                        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} {v.label ? `· ${v.label}` : ""}</option>)}
                      </select>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <UserRound size={12} />
                        Pengemudi
                      </span>
                      <select value={form.driverId} onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))} required>
                        <option value="">Pilih pengemudi</option>
                        {drivers.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
                      </select>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <Navigation size={12} />
                        Lokasi tujuan
                      </span>
                      <select value={form.deliveryLocationId} onChange={(e) => setForm((f) => ({ ...f, deliveryLocationId: e.target.value }))} required>
                        <option value="">Pilih lokasi tujuan</option>
                        {deliveryLocations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
                      </select>
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        Waktu berangkat
                      </span>
                      <input type="datetime-local" value={form.plannedDepartureAt} onChange={(e) => setForm((f) => ({ ...f, plannedDepartureAt: e.target.value }))} required />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Waktu tiba (estimasi)
                      </span>
                      <input type="datetime-local" value={form.plannedArrivalAt} onChange={(e) => setForm((f) => ({ ...f, plannedArrivalAt: e.target.value }))} required />
                    </div>
                    <div className="trip-form-field">
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12}>
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        Jumlah porsi
                      </span>
                      <input type="number" value={form.plannedQuantity} onChange={(e) => setForm((f) => ({ ...f, plannedQuantity: e.target.value }))} placeholder="0" min="0" required />
                    </div>
                  </div>
                  {formError && (
                    <div className="trip-modal-error" role="alert">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      <span>{formError}</span>
                    </div>
                  )}
                  <div className="trip-action-buttons">
                    <button type="button" className="trip-action-button muted" onClick={() => setShowForm(false)} disabled={submitting}>
                      Batal
                    </button>
                    <button type="submit" className="trip-action-button primary" disabled={submitting}>
                      {submitting ? "Menyimpan..." : "Simpan perjalanan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section className="panel trips-panel" aria-label="Perjalanan terkini">
            <div className="panel-heading">
              <div>
                <div className="section-title-row"><h2>Perjalanan terkini</h2><span className="count-chip">{trips.filter(t => ["IN_TRANSIT","DELIVERY_IN_PROGRESS","ARRIVAL_DETECTED","ARRIVAL_VERIFIED"].includes(t.status)).length} aktif</span></div>
                <p>Diurutkan berdasarkan waktu berangkat.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>PERJALANAN</th><th>RUTE &amp; PENGEMUDI</th><th>STATUS</th><th>PORSI</th><th>ETA</th></tr>
                </thead>
                <tbody>
                  {trips.map((trip) => {
                    const state = tripState(trip.status);
                    return (
                      <tr key={trip.id}>
                        <td><span className="trip-id">TRP-{trip.id.slice(0, 8).toUpperCase()}</span><span className="table-sub">{trip.vehicle?.plateNumber ?? "—"} <i>·</i> {formatClock(trip.plannedDepartureAt)}</span></td>
                        <td><div className="driver-cell"><span className="driver-avatar avatar-blue">{trip.driver?.name?.charAt(0) ?? "?"}</span><span className="route-copy"><strong>{trip.deliveryLocation?.name ?? "—"}</strong><small>{trip.driver?.name ?? "—"}</small></span></div></td>
                        <td><span className={`status-pill status-${state.tone}`}><span className="status-dot" />{state.label}</span></td>
                        <td><span className="portion-value">{trip.plannedQuantity ?? "—"} porsi</span></td>
                        <td><span className="eta-value">{trip.status === "COMPLETED" ? "Selesai" : trip.status === "CANCELLED" ? "—" : formatClock(trip.plannedArrivalAt)}</span></td>
                      </tr>
                    );
                  })}
                  {!trips.length && <tr><td colSpan={5} className="table-empty">Belum ada perjalanan.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> RADAR MBG <i>·</i> Data operasional tenant</span>
            <span>Zona waktu Asia/Jakarta <i>·</i> {trips.length} perjalanan</span>
          </footer>
        </main>
      </section>
    </div>
  );
}