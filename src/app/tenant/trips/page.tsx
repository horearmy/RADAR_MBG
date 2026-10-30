"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeaderAccount } from "@/components/account-menu";
import {
  ArrowLeft,
  CalendarClock,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  createTrip,
  getCurrentSession,
  getSppgOptions,
  getTripResourceOptions,
  getTrips,
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

function defaultTripForm(nowMs: number = Date.now()): TripFormState {
  const now = new Date(nowMs + WIB_OFFSET_MS);
  const arrival = new Date(now.getTime() + 2 * 60 * 60_000);
  return {
    sppgId: "",
    deliveryLocationId: "",
    vehicleId: "",
    driverId: "",
    plannedDepartureAt: toWibInput(now),
    plannedArrivalAt: toWibInput(arrival),
    plannedQuantity: "100",
  };
}

function toWibInput(date: Date) {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;
}

function wibInputToIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function TenantTripsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState<TripFormState>({ sppgId: '', deliveryLocationId: '', vehicleId: '', driverId: '', plannedDepartureAt: '', plannedArrivalAt: '', plannedQuantity: '100' });
  const [sppgOptions, setSppgOptions] = useState<SppgSummary[] | null>(null);
  const [resources, setResources] = useState<TripResourceOptions | null>(null);
  const [optionsState, setOptionsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [resourceState, setResourceState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const resourceRequestRef = useRef(0);

  useEffect(() => {
    setForm(defaultTripForm(Date.now()));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const result: Paginated<TripSummary> = await getTrips({ page, pageSize: PAGE_SIZE });
      setRows(result.data ?? []);
      setTotalPages(result.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat perjalanan");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadResources(sppgId: string) {
    const requestId = ++resourceRequestRef.current;
    setResourceState("loading");
    try {
      const result = await getTripResourceOptions(sppgId);
      if (requestId !== resourceRequestRef.current) return;
      setResources(result);
      setResourceState("ready");
    } catch {
      if (requestId !== resourceRequestRef.current) return;
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
      if (firstSppg) await loadResources(firstSppg.id);
    } catch {
      setOptionsState("error");
    }
  }

  function openCreate() {
    if (createBusy) return;
    setCreateOpen(true);
    setCreateError("");
    setForm(defaultTripForm(Date.now()));
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

  function changeDeparture(value: string) {
    setForm((current) => {
      const departure = wibInputToIso(value);
      const arrival = wibInputToIso(current.plannedArrivalAt);
      if (!departure || (arrival && new Date(arrival) > new Date(departure))) {
        return { ...current, plannedDepartureAt: value };
      }
      const nextArrival = new Date(new Date(departure).getTime() + 2 * 60 * 60_000);
      return { ...current, plannedDepartureAt: value, plannedArrivalAt: toWibInput(nextArrival) };
    });
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

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createBusy) return;
    setCreateError("");

    if (resourceState !== "ready" || !resources) {
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

    setCreateBusy(true);
    try {
      await createTrip({
        sppgId: form.sppgId,
        deliveryLocationId: form.deliveryLocationId,
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        plannedDepartureAt,
        plannedArrivalAt,
        plannedQuantity,
      });
      closeCreate();
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat perjalanan");
    } finally {
      setCreateBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.id.toLowerCase().includes(q) ||
      row.driver?.name?.toLowerCase().includes(q) ||
      row.vehicle?.plateNumber?.toLowerCase().includes(q) ||
      row.deliveryLocation?.name?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="p-6">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />MANAJEMEN</div>
          <h1>Perjalanan</h1>
          <p>Perjalanan distribusi milik SPPG Anda.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Tambah perjalanan</button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Daftar perjalanan</h2>
        </div>
        <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>STATUS</th>
                  <th>DRIVER</th>
                  <th>KENDARAAN</th>
                  <th>TUJUAN</th>
                  <th>QTY</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id.slice(0, 8)}</td>
                    <td><span className="status-pill">{row.status}</span></td>
                    <td>{row.driver?.name ?? "-"}</td>
                    <td>{row.vehicle?.plateNumber ?? "-"}</td>
                    <td>{row.deliveryLocation?.name ?? "-"}</td>
                    <td>{row.plannedQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      {createOpen && (
        <div className="modal-backdrop" style={{ background: 'rgba(7,27,58,.45)', backdropFilter: 'blur(4px)' }}>
          <div className="modal" style={{ borderRadius: 14, boxShadow: '0 24px 60px rgba(7,27,58,.25)', animation: 'modalIn .2s ease' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border)', padding: '16px 20px' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>Tambah Perjalanan</h2>
              <button onClick={closeCreate} style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitCreate} className="modal-body" style={{ display: 'grid', gap: 14, padding: 20 }}>
              {createError && <p className="text-danger">{createError}</p>}
              <div className="form-grid">
                <div className="form-row">
                  <label>SPPG</label>
                  <select value={form.sppgId} onChange={(e) => changeSppg(e.target.value)} required>
                    <option value="">Pilih SPPG</option>
                    {(sppgOptions ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Tujuan</label>
                  <select value={form.deliveryLocationId} onChange={(e) => updateField("deliveryLocationId", e.target.value)} required disabled={resourceState !== "ready"}>
                    <option value="">Pilih tujuan</option>
                    {(resources?.deliveryLocations ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Kendaraan</label>
                  <select value={form.vehicleId} onChange={(e) => updateField("vehicleId", e.target.value)} required disabled={resourceState !== "ready"}>
                    <option value="">Pilih kendaraan</option>
                    {(resources?.vehicles ?? []).map((v) => (
                      <option key={v.id} value={v.id}>{v.plateNumber}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Driver</label>
                  <select value={form.driverId} onChange={(e) => updateField("driverId", e.target.value)} required disabled={resourceState !== "ready"}>
                    <option value="">Pilih driver</option>
                    {(resources?.drivers ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row two-col">
                  <div>
                    <label>Berangkat</label>
                    <input type="datetime-local" value={form.plannedDepartureAt} onChange={(e) => changeDeparture(e.target.value)} required />
                  </div>
                  <div>
                    <label>Tiba</label>
                    <input type="datetime-local" value={form.plannedArrivalAt} onChange={(e) => updateField("plannedArrivalAt", e.target.value)} required />
                  </div>
                </div>
                <div className="form-row">
                  <label>Jumlah porsi</label>
                  <input type="number" min={1} max={100000} value={form.plannedQuantity} onChange={(e) => updateField("plannedQuantity", e.target.value)} required />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeCreate}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={createBusy}>{createBusy ? "Menyimpan..." : "Buat perjalanan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes modalIn { from { opacity:.7; transform: translateY(8px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}