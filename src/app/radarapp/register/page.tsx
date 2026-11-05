"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, QrCode } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

function RegisterContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [form, setForm] = useState({
    requesterName: "",
    contactPhone: "",
    contactEmail: "",
    requestedSiteName: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setCodeError("Kode pendaftaran tidak ditemukan.");
      setValidating(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/public/recipient-registrations/codes/${encodeURIComponent(code)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Kode tidak valid atau kedaluwarsa.");
        const data = await res.json();
        if (!active) return;
        setTenantName(data?.tenant?.name ?? null);
      } catch (err) {
        if (!active) return;
        setCodeError(err instanceof Error ? err.message : "Kode tidak valid.");
      } finally {
        if (active) setValidating(false);
      }
    })();
    return () => { active = false; };
  }, [code]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const csrf = await csrfRes.json().catch(() => null);
      const res = await fetch(`${apiBaseUrl}/public/recipient-registrations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf?.csrfToken ? { "X-CSRF-Token": csrf.csrfToken } : {}) },
        body: JSON.stringify({ code, ...form }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? "Gagal mendaftar.");
      setResult({ id: body.id, status: body.status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (validating) {
    return <main className="field-app"><div className="field-content"><p>Memvalidasi kode...</p></div></main>;
  }

  if (codeError) {
    return (
      <main className="field-app">
        <div className="field-content">
          <div className="field-card">
            <h1>Kode tidak valid</h1>
            <p>{codeError}</p>
          </div>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="field-app">
        <div className="field-content">
          <div className="field-card" style={{ textAlign: "center" }}>
            <CheckCircle2 size={48} />
            <h1>Pendaftaran terkirim</h1>
            <p>Status: {result.status}</p>
            <p>Permintaan Anda sedang ditinjau oleh administrator. Anda akan dihubungi setelah disetujui.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="field-app">
      <div className="field-content">
        <div className="field-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <QrCode size={20} />
            <h1>Pendaftaran Penerima</h1>
          </div>
          {tenantName && <p style={{ marginBottom: 12 }}>SPPG: <strong>{tenantName}</strong></p>}
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <label>
              Nama lengkap
              <input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} required />
            </label>
            <label>
              Nomor telepon
              <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </label>
            <label>
              Lokasi penerima yang diminta
              <input value={form.requestedSiteName} onChange={(e) => setForm({ ...form, requestedSiteName: e.target.value })} />
            </label>
            <label>
              Catatan
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {error && <p style={{ color: "#DC2626" }}>{error}</p>}
            <button type="submit" disabled={submitting}>{submitting ? "Mengirim..." : "Kirim Pendaftaran"}</button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="field-app"><div className="field-content"><p>Memuat...</p></div></main>}>
      <RegisterContent />
    </Suspense>
  );
}