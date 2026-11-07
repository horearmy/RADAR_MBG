"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";
import desktopBg from "@/bg/dekstop.webp";
import mobileBg from "@/bg/mobile.webp";
import { isPlatformAdmin } from "@/lib/api";

export default function PlatformLoginPage() {
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
    (async () => {
      try {
        const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include", cache: "no-store" });
        if (!csrfResponse.ok) throw new Error("CSRF_UNAVAILABLE");
        const result = (await csrfResponse.json()) as { csrfToken?: string };
        if (!result.csrfToken) throw new Error("CSRF_UNAVAILABLE");
        if (active) setCsrfToken(result.csrfToken);
      } catch {
        if (active) setError("Layanan login tidak dapat dijangkau. Periksa koneksi API lalu coba lagi.");
      }
    })();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          username,
          password,
          ...(needsMfa && !useRecoveryCode && otpCode ? { otpCode } : {}),
          ...(needsMfa && useRecoveryCode && recoveryCode ? { recoveryCode: recoveryCode.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
        if (payload.code === "MFA_REQUIRED") {
          setNeedsMfa(true);
          setError("Masukkan kode autentikasi dari aplikasi MFA.");
        } else if (payload.code === "MFA_INVALID") {
          setNeedsMfa(true);
          setError("Kode MFA tidak valid.");
        } else if (payload.code === "LOGIN_RATE_LIMITED") {
          setError("Terlalu banyak percobaan. Tunggu sebentar.");
        } else {
          setError(payload.message ?? "Username atau kata sandi tidak valid.");
        }
        return;
      }

      // Verify platform admin
      const sessionRes = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" });
      const session = sessionRes.ok ? await sessionRes.json() : null;
      if (!session?.user || !isPlatformAdmin(session.user)) {
        // logout
        try {
          const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
          const csrf = await csrfRes.json().catch(() => null);
          if (csrf?.csrfToken) {
            await fetch(`${apiBaseUrl}/auth/logout`, {
              method: "POST",
              credentials: "include",
              headers: { "x-csrf-token": csrf.csrfToken },
            });
          }
        } catch {}
        setError("Akses terbatas: halaman ini hanya untuk superadmin platform.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Layanan login tidak dapat dijangkau. Coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="login-shell"
      style={{
        gridTemplateColumns: "1fr",
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <Image src={desktopBg} alt="" fill priority className="hidden md:block" style={{ objectFit: "cover" }} />
      <Image src={mobileBg} alt="" fill priority className="md:hidden" style={{ objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(7,27,58,.82), rgba(7,27,58,.50))", zIndex: 1 }} />
      <div className="login-panel" style={{ background: "transparent", position: "relative", zIndex: 2 }}>
        <div className="login-card-wrap">
          <div className="login-heading">
            <div className="login-icon" style={{ width: 48, height: 48 }}><ShieldCheck size={28} /></div>
            <p className="login-eyebrow" style={{ color: "#071B3A" }}>
              <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, background: "#FDECEC", color: "#A41919", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", marginRight: 8 }}>RESTRICTED</span>
              PLATFORM SUPERADMIN
            </p>
            <h2 style={{ textTransform: "capitalize" }}>Masuk ke Platform</h2>
            <p className="login-description">Akses terbatas untuk administrator platform RADAR MBG.</p>
          </div>
          {error && <div className="login-feedback" role="alert">{error}</div>}
          <form className="login-form" onSubmit={submit}>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
            </label>
            <label>
              Password
              <div className="password-field">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {needsMfa && (
              <>
                <label>
                  Kode MFA
                  <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="6 digit" inputMode="numeric" />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={useRecoveryCode} onChange={(e) => setUseRecoveryCode(e.target.checked)} />
                  Gunakan kode pemulihan
                </label>
                {useRecoveryCode && (
                  <label>
                    Kode pemulihan
                    <input value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
                  </label>
                )}
              </>
            )}
            <button className="login-submit" type="submit" disabled={loading || !csrfToken}>
              {loading ? "Memverifikasi..." : "Masuk"}
            </button>
          </form>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#718096" }}>
            <span>🔒 HTTPS</span>
            <span>🛡️ MFA wajib</span>
            <span>⏱️ Sesi 8 jam</span>
          </div>
          <p style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "#9AA5B2" }}>
            Semua akses dicatat. Sesi berakhir otomatis saat tidak aktif.
          </p>
        </div>
      </div>
    </main>
  );
}
