"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, User } from "lucide-react";
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

export default function LoginPage() {
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
    let active = true;

    async function prepareLogin() {
      if (!apiBaseUrl) {
        setError("API belum dikonfigurasi untuk lingkungan ini.");
        return;
      }

      try {
        const sessionResponse = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (sessionResponse.ok) {
          router.replace("/");
          return;
        }

        const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!csrfResponse.ok) throw new Error("CSRF_UNAVAILABLE");
        const result = (await csrfResponse.json()) as { csrfToken?: string };
        if (!result.csrfToken) throw new Error("CSRF_UNAVAILABLE");
        if (active) setCsrfToken(result.csrfToken);
      } catch {
        if (active) setError("Layanan login tidak dapat dijangkau. Periksa koneksi API lalu coba lagi.");
      }
    }

    void prepareLogin();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken || loading) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          username,
          password,
          ...(needsMfa && !useRecoveryCode && otpCode ? { otpCode } : {}),
          ...(needsMfa && useRecoveryCode && recoveryCode ? { recoveryCode: recoveryCode.trim() } : {}),
        }),
      });

      if (response.ok) {
        router.replace("/");
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
    <main className="login-shell">
      <section className="login-story">
        <Link className="login-brand" href="/" aria-label="RADAR MBG">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-copy"><strong>RADAR<span>MBG</span></strong><small>Operational intelligence</small></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-kicker"><span /> PLATFORM PEMANTAUAN DISTRIBUSI</span>
          <h1>Distribusi terpantau.<br /><span>Penyaluran terverifikasi.</span></h1>
          <p>Satu ruang kendali untuk memantau perjalanan, memastikan kedatangan, dan menelusuri serah-terima Makan Bergizi Gratis.</p>
        </div>
        <div className="login-story-footer"><span><ShieldCheck size={15} /> Akses terbatas untuk pengguna terdaftar</span><span>RADAR MBG <i>·</i> Control Tower</span></div>
      </section>

      <section className="login-panel">
        <div className="login-card-wrap">
          <div className="login-mobile-brand"><span className="brand-mark"><span /><span /><span /></span><strong>RADAR<span>MBG</span></strong></div>
          <div className="login-heading"><div className="login-icon"><LockKeyhole size={18} /></div><p className="login-eyebrow">PORTAL OPERASIONAL</p><h2>Selamat datang</h2><p className="login-description">Masuk menggunakan akun yang diberikan administrator.</p></div>

          <Suspense fallback={null}><SessionNotice /></Suspense>
          {error && <div className={`login-feedback ${needsMfa ? "login-feedback-info" : ""}`} role="status">{error}</div>}

          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <div style={{ position: "relative" }}>
              <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9AA5B2" }} aria-hidden="true" />
              <input
                autoComplete="username"
                autoCapitalize="none"
                id="username"
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Masukkan username"
                required
                style={{ paddingLeft: 36 }}
                value={username}
              />
            </div>

            <div className="login-label-row"><label htmlFor="password">Kata sandi</label><span>Gunakan kredensial resmi Anda</span></div>
            <div className="password-field"><LockKeyhole size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9AA5B2", zIndex: 1 }} aria-hidden="true" /><input
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi"
              required
              style={{ paddingLeft: 36 }}
              type={showPassword ? "text" : "password"}
              value={password}
            /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>

            {needsMfa && !useRecoveryCode && <><label htmlFor="otpCode">Kode MFA</label><div style={{ position: "relative" }}><KeyRound size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9AA5B2" }} aria-hidden="true" /><input
              autoComplete="one-time-code"
              id="otpCode"
              inputMode="numeric"
              maxLength={6}
              name="otpCode"
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              pattern="[0-9]{6}"
              placeholder="6 digit kode autentikasi"
              required
              style={{ paddingLeft: 36 }}
              value={otpCode}
            /></div><button className="login-recovery-toggle" onClick={() => { setUseRecoveryCode(true); setOtpCode(""); setError(""); }} type="button">Gunakan kode pemulihan</button></>}
            {needsMfa && useRecoveryCode && <><label htmlFor="recoveryCode">Kode pemulihan</label><input
              autoComplete="one-time-code"
              id="recoveryCode"
              maxLength={32}
              onChange={(event) => setRecoveryCode(event.target.value.trim())}
              placeholder="Masukkan kode sekali pakai"
              required
              value={recoveryCode}
            /><button className="login-recovery-toggle" onClick={() => { setUseRecoveryCode(false); setRecoveryCode(""); setError(""); }} type="button">Kembali ke kode authenticator</button></>}

            <button className="login-submit" disabled={!csrfToken || loading} type="submit">
              <span>{loading ? "Memverifikasi…" : needsMfa ? "Verifikasi dan masuk" : "Masuk ke RADAR MBG"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="login-security"><ShieldCheck size={15} /><span>Sesi aman · Aktivitas autentikasi dicatat</span></div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#718096" }}>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: "#F0F4F8" }}>🔒 HTTPS</span>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: "#F0F4F8" }}>🛡️ MFA</span>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: "#F0F4F8" }}>⏱️ Sesi 8 jam</span>
          </div>
          <p className="login-no-account">Tidak memiliki akun? Hubungi administrator RADAR MBG.</p>
          <p className="login-no-account"><Link href="/security/mfa/recovery">Pulihkan MFA dengan token administrator</Link></p>
        </div>
        <div className="login-panel-footer">© 2026 RADAR MBG <span>·</span> Sistem Pemantauan Distribusi</div>
      </section>
    </main>
  );
}
