"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Truck } from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

export default function VehicleEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [form, setForm] = useState({ label: "", capacity: "", status: "ACTIVE", reason: "" });

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const res = await fetch(`${apiBase}/admin/vehicles?page=1&pageSize=100`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat kendaraan");
      const json = await res.json();
      const found = (json.data ?? []).find((x: any) => x.id === params.id);
      if (!found) throw new Error("Kendaraan tidak ditemukan");
      setVehicle(found);
      setForm({ label: found.label ?? "", capacity: found.capacity ?? "", status: found.status ?? "ACTIVE", reason: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    if (!form.reason.trim() || form.reason.trim().length < 3) return setError("Alasan wajib diisi minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const body: any = { status: form.status, reason: form.reason.trim() };
      if (form.label.trim()) body.label = form.label.trim();
      if (form.capacity !== "") body.capacity = Number(form.capacity);
      const res = await fetch(`${apiBase}/admin/vehicles/${params.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? "Gagal menyimpan");
      router.push(`/vehicles/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (user && !hasPermission(user, "master:manage")) {
    return (
      <main className="page">
        <header className="page-hero"><div className="page-hero-content"><h1 className="page-title">Edit Kendaraan</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-hero">
        <div className="page-hero-content">
          <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Kendaraan &gt; {vehicle?.plateNumber ?? params.id} &gt; Edit</p>
          <div className="page-hero-title-row">
            <div className="page-hero-icon"><Truck size={20} /></div>
            <div>
              <h1 className="page-title">Edit Kendaraan</h1>
              <p className="page-subtitle">Perbarui label, kapasitas, dan status operasional kendaraan.</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push(`/vehicles/${params.id}`)}><ArrowLeft size={16} /> Kembali</button>
        </div>
      </header>

      <section className="panel">
        {loading && <p className="text-secondary" style={{ padding: "14px 16px" }}>Memuat...</p>}
        {error && <p className="text-danger" style={{ padding: "14px 16px 0" }}>{error}</p>}
        {!loading && vehicle && (
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="form-section">
              <h2>Informasi Kendaraan</h2>
              <div className="form-row two-col">
                <div>
                  <label>Nomor Plat</label>
                  <input value={vehicle.plateNumber} disabled />
                </div>
                <div>
                  <label>SPPG</label>
                  <input value={vehicle.sppg?.name ?? vehicle.sppgId} disabled />
                </div>
              </div>
              <div className="form-row two-col">
                <div>
                  <label>Label / Jenis</label>
                  <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div>
                  <label>Kapasitas (porsi)</label>
                  <input type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <label>Status Operasional</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Aktif</option>
                  <option value="MAINTENANCE">Perawatan</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h2>Audit</h2>
              <div className="form-row">
                <label>Alasan perubahan *</label>
                <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} required placeholder="Minimal 3 karakter" />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" type="button" onClick={() => router.push(`/vehicles/${params.id}`)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Perubahan"}</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
