"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Navigation, ShieldCheck } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type ApiError = { code?: string; message?: string };

function SessionNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("expired") !== "1") return null;
  return (
    <div className="login-feedback login-feedback-info" role="status">
      Sesi Anda tidak ditemukan atau telah berakhir. Silakan masuk kembali.
    </div>
  );
}

export default function DriverLoginPage() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // No-op: CSRF token fetched on submit
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!csrfResponse.ok) throw new Error("CSRF_UNAVAILABLE");
      const csrfResult = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfResult.csrfToken) throw new Error("CSRF_UNAVAILABLE");
      const token = csrfResult.csrfToken;
      setCsrfToken(token);

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          username,
          password,
          ...(needsMfa && !useRecoveryCode && otpCode ? { otpCode } : {}),
          ...(needsMfa && useRecoveryCode && recoveryCode ? { recoveryCode: recoveryCode.trim() } : {}),
        }),
      });

      if (response.ok) {
        // Check if user is a driver
        const sessionResponse = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (session.user?.tenantRole === "TENANT_DRIVER") {
            router.replace("/driver");
            router.refresh();
            return;
          }
          // Not a driver
          setError("Akun ini bukan akun driver. Gunakan login platform.");
          // Logout
          const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
          const { csrfToken: ct } = await csrfRes.json();
          await fetch(`${apiBaseUrl}/auth/logout`, {
            method: "POST",
            credentials: "include",
            headers: { "x-csrf-token": ct },
          });
          return;
        }
        router.replace("/driver");
        router.refresh();
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as ApiError;
      if (payload.code === "MFA_REQUIRED") {
        setNeedsMfa(true);
        setError("Masukkan kode autentikasi dari aplikasi MFA.");
      } else if (payload.code === "MFA_SETUP_REQUIRED") {
        setError("Akun ini memerlukan penyiapan MFA. Hubungi administrator sistem.");
      } else if (payload.code === "MFA_INVALID") {
        setNeedsMfa(true);
        setError("Kode MFA tidak valid. Periksa kode terbaru lalu coba kembali.");
      } else if (payload.code === "MFA_RECOVERY_CODE_INVALID") {
        setNeedsMfa(true);
        setError("Kode pemulihan tidak valid atau sudah digunakan.");
      } else if (payload.code === "LOGIN_RATE_LIMITED") {
        setError("Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.");
      } else if (response.status >= 500) {
        setError("Autentikasi belum dapat memeriksa akun. Pastikan PostgreSQL aktif dan migrasi database sudah diterapkan.");
      } else {
        setError("Username atau kata sandi tidak valid.");
      }
    } catch {
      setError("Layanan login tidak dapat dijangkau. Coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-story">
        <Link className="login-brand" href="/" aria-label="RADAR MBG">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-copy"><strong>RADAR<span>MBG</span></strong><small>APLIKASI RADAR MBG — Field App</small></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-kicker">FIELD APP — OPERASIONAL</span>
          <h1>Masuk ke aplikasi field.</h1>
          <p>Kelola tugas perjalanan, lacak posisi, kirim bukti pengiriman, dan pantau penerimaan MBG.</p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-card">
          <div className="login-form-header">
            <span className="login-form-icon"><Navigation size={20} /></span>
            <div>
              <h2>Masuk</h2>
              <p>Gunakan akun yang diberikan oleh admin SPPG.</p>
            </div>
          </div>

          <Suspense fallback={null}>
            <SessionNotice />
          </Suspense>

          {error && <div className="login-feedback login-feedback-error" role="alert">{error}</div>}

          <form className="login-form" onSubmit={submit}>
            <label className="login-field">
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username driver"
                autoComplete="username"
                required
              />
            </label>

            <label className="login-field">
              <span>Kata sandi</span>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata sandi"
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {needsMfa && (
              <>
                <label className="login-field">
                  <span>{useRecoveryCode ? "Kode pemulihan" : "Kode MFA"}</span>
                  <input
                    type="text"
                    value={useRecoveryCode ? recoveryCode : otpCode}
                    onChange={(e) => useRecoveryCode ? setRecoveryCode(e.target.value) : setOtpCode(e.target.value)}
                    placeholder={useRecoveryCode ? "Kode pemulihan" : "123456"}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
                <button type="button" className="login-recovery-toggle" onClick={() => setUseRecoveryCode((v) => !v)}>
                  {useRecoveryCode ? "Gunakan kode MFA" : "Gunakan kode pemulihan"}
                </button>
              </>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? "Memproses…" : "Masuk"}
            </button>
          </form>

          <div className="login-form-footer">
          </div>
        </div>
      </section>
    </div>
  );
}