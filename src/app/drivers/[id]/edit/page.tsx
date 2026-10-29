"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

export default function DriverEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driver, setDriver] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", status: "ACTIVE", reason: "" });

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const res = await fetch(`${apiBase}/admin/drivers?page=1&pageSize=100`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat driver");
      const json = await res.json();
      const found = (json.data ?? []).find((x: any) => x.id === params.id);
      if (!found) throw new Error("Driver tidak ditemukan");
      setDriver(found);
      setForm({ name: found.name ?? "", phone: found.phone ?? "", status: found.status ?? "ACTIVE", reason: "" });
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
    if (!driver) return;
    if (!form.name.trim()) return setError("Nama wajib diisi");
    if (!form.reason.trim() || form.reason.trim().length < 3) return setError("Alasan wajib diisi minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const res = await fetch(`${apiBase}/admin/drivers/${params.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          status: form.status,
          reason: form.reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? "Gagal menyimpan");
      router.push(`/drivers/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (user && !hasPermission(user, "master:manage")) {
    return (
      <main className="page">
        <header className="page-header"><div><h1 className="page-title">Edit Driver</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">Operasional &gt; Driver &gt; {driver?.code ?? params.id} &gt; Edit</p>
          <h1 className="page-title">Edit Driver</h1>
          <p className="page-subtitle">Perbarui profil, kontak, dan status driver.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push(`/drivers/${params.id}`)}><ArrowLeft size={16} /> Kembali</button>
        </div>
      </header>

      <section className="panel">
        {loading && <p className="text-secondary">Memuat...</p>}
        {error && <p className="text-danger">{error}</p>}
        {!loading && driver && (
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="form-section">
              <h2>Profil</h2>
              <div className="form-row two-col">
                <div>
                  <label>ID Driver</label>
                  <input value={driver.code} disabled />
                </div>
                <div>
                  <label>SPPG</label>
                  <input value={driver.sppg?.name ?? driver.sppgId} disabled />
                </div>
              </div>
              <div className="form-row">
                <label>Nama Lengkap *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Kontak Kerja</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>

            <div className="form-section">
              <h2>Status Akun & Ketersediaan</h2>
              <div className="form-row">
                <label>Status Akun</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                  <option value="SUSPENDED">Ditangguhkan</option>
                </select>
              </div>
              <p className="text-muted">Status akun berbeda dari ketersediaan bertugas. Perubahan status perlu konfirmasi dan audit.</p>
            </div>

            <div className="form-section">
              <h2>Audit</h2>
              <div className="form-row">
                <label>Alasan perubahan *</label>
                <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} required placeholder="Minimal 3 karakter" />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" type="button" onClick={() => router.push(`/drivers/${params.id}`)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Driver"}</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
