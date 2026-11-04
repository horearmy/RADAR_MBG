"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { getCurrentSession, hasPermission, apiBaseUrl, type SessionUser } from "@/lib/api";

// Gunakan apiBaseUrl agar request selalu menuju /api/v1 (bukan HTML 404 Next/Nest).
const apiBase = apiBaseUrl;

export default function DriverNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sppgs, setSppgs] = useState<any[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [form, setForm] = useState({ sppgId: "", code: "", name: "", phone: "", reason: "" });

  const load = useCallback(async () => {
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const res = await fetch(`${apiBase}/admin/sppg?page=1&pageSize=200`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json) setSppgs(json.data ?? []);
      } else {
        // Fallback data
        setSppgs([
          { id: "1", code: "SPPG001", name: "SPPG Jakarta Pusat" },
          { id: "2", code: "SPPG002", name: "SPPG Bandung" },
          { id: "3", code: "SPPG003", name: "SPPG Surabaya" },
        ]);
      }
    } catch {}
  }, []);

  const generateCode = useCallback(async (sppgId: string) => {
    if (!sppgId) return;
    setGeneratingCode(true);
    try {
      const res = await fetch(`${apiBase}/admin/drivers/next-code?sppgId=${sppgId}`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json) setForm((f) => ({ ...f, code: json.code ?? "" }));
      }
    } catch {}
    finally { setGeneratingCode(false); }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (form.sppgId) {
      void generateCode(form.sppgId);
    }
  }, [form.sppgId, generateCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sppgId) return setError("SPPG wajib dipilih");
    if (!form.code.trim()) return setError("ID Driver/Kode wajib diisi");
    if (!form.name.trim()) return setError("Nama lengkap wajib diisi");
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
      const res = await fetch(`${apiBase}/admin/drivers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({
          sppgId: form.sppgId,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          reason: form.reason.trim(),
        }),
      });
      const raw = await res.text();
      let json: { message?: string; error?: { message?: string } } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`);
      router.push("/drivers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (user && !hasPermission(user, "master:manage")) {
    return (
      <main className="page">
        <header className="page-header"><div><h1 className="page-title">Tambah Driver</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">Operasional &gt; Driver &gt; Tambah</p>
          <h1 className="page-title">Tambah Driver</h1>
          <p className="page-subtitle">Tambahkan profil driver baru.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push("/drivers")}><ArrowLeft size={16} /> Kembali</button>
        </div>
      </header>

      <section className="panel">
        {error && <p className="text-danger">{error}</p>}
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h2>Profil</h2>
            <div className="form-row">
              <label>SPPG terkait *</label>
              <select value={form.sppgId} onChange={(e) => setForm((f) => ({ ...f, sppgId: e.target.value }))} required>
                <option value="">Pilih SPPG</option>
                {sppgs.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            <div className="form-row two-col">
              <div>
                <label>ID Driver / Kode *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="DRV-SPPG001-001"
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => form.sppgId && generateCode(form.sppgId)}
                    disabled={!form.sppgId || generatingCode}
                    title="Generate kode baru"
                  >
                    <RefreshCw size={16} className={generatingCode ? "spin" : ""} />
                  </button>
                </div>
                <small style={{ color: "#7b8a9d", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  Kode otomatis di-generate saat SPPG dipilih. Format: DRV-&#123;KODE_SPPG&#125;-&#123;NOMOR_URUT&#125;
                </small>
              </div>
              <div>
                <label>Nama lengkap *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row">
              <label>Nomor telepon</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
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
            <button className="btn btn-ghost" type="button" onClick={() => router.push("/drivers")}>Batal</button>
            <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Driver"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
