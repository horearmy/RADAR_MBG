"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Truck } from "lucide-react";
import { getCurrentSession, hasPermission, apiBaseUrl, type SessionUser } from "@/lib/api";

const apiBase = apiBaseUrl;

export default function VehicleNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sppgs, setSppgs] = useState<any[]>([]);
  const [form, setForm] = useState({ sppgId: "", plateNumber: "", label: "", capacity: "", reason: "" });

  const load = useCallback(async () => {
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const res = await fetch(`${apiBase}/admin/sppg?page=1&pageSize=200`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json) setSppgs(json.data ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sppgId) return setError("SPPG wajib dipilih");
    if (!form.plateNumber.trim()) return setError("Nomor plat wajib diisi");
    if (!form.reason.trim() || form.reason.trim().length < 3) return setError("Alasan wajib diisi minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const csrfData = await csrfRes.json().catch(() => null) as { csrfToken?: string } | null;
      if (!csrfRes.ok || !csrfData?.csrfToken) {
        throw new Error("Gagal memulai sesi keamanan. Muat ulang halaman lalu coba lagi.");
      }
      const csrfToken = csrfData.csrfToken;
      const body: any = {
        sppgId: form.sppgId,
        plateNumber: form.plateNumber.trim().toUpperCase(),
        label: form.label.trim() || undefined,
        reason: form.reason.trim(),
      };
      if (form.capacity !== "") body.capacity = Number(form.capacity);
      const res = await fetch(`${apiBase}/admin/vehicles`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let json: { message?: string; error?: { message?: string } } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`);
      router.push("/vehicles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (user && !hasPermission(user, "master:manage")) {
    return (
      <main className="page">
        <header className="page-hero"><div className="page-hero-content"><h1 className="page-title">Tambah Kendaraan</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-hero">
        <div className="page-hero-content">
          <p className="page-breadcrumb">Operasional &gt; Manajemen &gt; Kendaraan &gt; Tambah</p>
          <div className="page-hero-title-row">
            <div className="page-hero-icon"><Truck size={20} /></div>
            <div>
              <h1 className="page-title">Tambah Kendaraan</h1>
              <p className="page-subtitle">Tambahkan kendaraan baru ke dalam armada SPPG.</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push("/vehicles")}><ArrowLeft size={16} /> Kembali</button>
        </div>
      </header>

      <section className="panel">
        {error && <p className="text-danger" style={{ padding: "14px 16px 0" }}>{error}</p>}
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h2>Informasi Kendaraan</h2>
            <div className="form-row">
              <label>SPPG Pemilik *</label>
              <select value={form.sppgId} onChange={(e) => setForm((f) => ({ ...f, sppgId: e.target.value }))} required>
                <option value="">Pilih SPPG</option>
                {sppgs.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Nomor Plat *</label>
                <input value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} placeholder="B 1234 XYZ" required />
              </div>
              <div>
                <label>Label / Jenis Kendaraan</label>
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Box / Pick Up / Lainnya" />
              </div>
            </div>
            <div className="form-row">
              <label>Kapasitas (porsi)</label>
              <input type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Contoh: 250" />
            </div>
          </div>

          <div className="form-section">
            <h2>Audit</h2>
            <div className="form-row">
              <label>Alasan penambahan *</label>
              <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} required placeholder="Minimal 3 karakter" />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={() => router.push("/vehicles")}>Batal</button>
            <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Kendaraan"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
