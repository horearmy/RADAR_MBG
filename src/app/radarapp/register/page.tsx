"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, QrCode } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

function RegisterContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const router = useRouter();
  const [manualCode, setManualCode] = useState("");
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleBtnRef = useRef<HTMLDivElement>(null);
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
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleClientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleReady || !googleBtnRef.current || !googleClientId) return;
    const g = (window as any).google;
    if (!g?.accounts?.id) return;
    g.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential: string }) => {
        setSubmitting(true);
        setError(null);
        try {
          const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
          const csrf = await csrfRes.json().catch(() => null);
          const res = await fetch(`${apiBaseUrl}/public/recipient-registrations/google`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...(csrf?.csrfToken ? { "X-CSRF-Token": csrf.csrfToken } : {}) },
            body: JSON.stringify({ code, idToken: response.credential }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) throw new Error(body?.message ?? "Gagal mendaftar dengan Google.");
          setResult({ id: body.id, status: body.status });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Gagal mendaftar dengan Google.");
        } finally {
          setSubmitting(false);
        }
      },
    });
    g.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      text: "signup_with",
      shape: "rectangular",
    });
  }, [googleReady, googleClientId, code]);

  useEffect(() => {
    if (!code) {
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

  if (!code) {
    return (
      <main className="field-app">
        <div className="field-content">
          <div className="field-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <QrCode size={20} />
              <h1>Pendaftaran Penerima</h1>
            </div>
            <p style={{ marginBottom: 12, color: "#718096" }}>
              Masukkan kode pendaftaran yang diberikan oleh administrator SPPG (atau scan QR code).
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = manualCode.trim();
                if (trimmed) router.push(`/radarapp/register?code=${encodeURIComponent(trimmed)}`);
              }}
              className="field-form"
            >
              <label className="field-field">
                <span>Kode pendaftaran</span>
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Contoh: REG-XXXX-XXXX" required />
              </label>
              <button type="submit" className="field-btn field-btn-block" data-variant="primary">
                Lanjutkan
              </button>
            </form>
          </div>
        </div>
      </main>
    );
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
          <form onSubmit={submit} className="field-form">
            <label className="field-field">
              <span>Nama lengkap</span>
              <input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} required />
            </label>
            <label className="field-field">
              <span>Nomor telepon</span>
              <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </label>
            <label className="field-field">
              <span>Email</span>
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </label>
            <label className="field-field">
              <span>Lokasi penerima yang diminta</span>
              <input value={form.requestedSiteName} onChange={(e) => setForm({ ...form, requestedSiteName: e.target.value })} />
            </label>
            <label className="field-field">
              <span>Catatan</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {error && <p className="field-error-text">{error}</p>}
            {googleClientId && (
              <div style={{ display: "grid", gap: 8 }}>
                <div ref={googleBtnRef} />
                {googleError && <p className="field-error-text">{googleError}</p>}
              </div>
            )}
            <button type="submit" className="field-btn field-btn-block" data-variant="primary" disabled={submitting}>
              {submitting ? "Mengirim..." : "Kirim Pendaftaran"}
            </button>
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