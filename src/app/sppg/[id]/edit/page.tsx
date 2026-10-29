"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

export default function SppgEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sppg, setSppg] = useState<any>(null);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "", reason: "" });

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const res = await fetch(`${apiBase}/admin/sppg?page=1&pageSize=100`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat SPPG");
      const json = await res.json();
      const found = (json.data ?? []).find((x: any) => x.id === params.id);
      if (!found) throw new Error("SPPG tidak ditemukan");
      setSppg(found);
      setForm({
        name: found.name ?? "",
        address: found.address ?? "",
        latitude: found.latitude ?? "",
        longitude: found.longitude ?? "",
        reason: "",
      });
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
    if (!sppg) return;
    if (!form.name.trim()) return setError("Nama SPPG wajib diisi");
    if (!form.reason.trim() || form.reason.trim().length < 3) return setError("Alasan wajib diisi minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const body: any = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        reason: form.reason.trim(),
        version: sppg.version,
      };
      if (form.latitude !== "" && form.longitude !== "") {
        body.latitude = Number(form.latitude);
        body.longitude = Number(form.longitude);
      }
      const res = await fetch(`${apiBase}/admin/sppg/${params.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? "Gagal menyimpan");
      router.push(`/sppg/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (user && !hasPermission(user, "master:manage")) {
    return (
      <main className="page">
        <header className="page-header"><div><h1 className="page-title">Edit SPPG</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">Operasional &gt; SPPG &gt; {sppg?.code ?? params.id} &gt; Edit</p>
          <h1 className="page-title">Edit SPPG</h1>
          <p className="page-subtitle">Perbarui profil dan lokasi SPPG.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push(`/sppg/${params.id}`)}><ArrowLeft size={16} /> Kembali</button>
        </div>
      </header>

      <section className="panel">
        {loading && <p className="text-secondary">Memuat...</p>}
        {error && <p className="text-danger">{error}</p>}
        {!loading && sppg && (
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="form-section">
              <h2>Informasi dasar</h2>
              <div className="form-row">
                <label>Kode SPPG</label>
                <input value={sppg.code} disabled />
              </div>
              <div className="form-row">
                <label>Nama SPPG *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Status</label>
                <input value={sppg.status} disabled />
              </div>
            </div>

            <div className="form-section">
              <h2>Lokasi</h2>
              <div className="form-row">
                <label>Alamat</label>
                <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={3} />
              </div>
              <div className="form-row two-col">
                <div>
                  <label>Latitude</label>
                  <input value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="-6.200000" />
                </div>
                <div>
                  <label>Longitude</label>
                  <input value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="106.816666" />
                </div>
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
              <button className="btn btn-ghost" type="button" onClick={() => router.push(`/sppg/${params.id}`)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan SPPG"}</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
