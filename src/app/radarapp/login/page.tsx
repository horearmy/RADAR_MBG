"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Package, Truck } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";
import { logoutField, resolveWorkspaces, WORKSPACE_HOME, type FieldWorkspace } from "@/lib/field-api";
import { safeErrorMessage } from "@/lib/field-status";
import { Banner } from "@/components/field-ui";

const LOGIN_ERRORS: Record<string, string> = {
  MFA_REQUIRED: "Masukkan kode autentikasi dari aplikasi MFA.",
  MFA_SETUP_REQUIRED: "Akun ini memerlukan penyiapan MFA. Hubungi administrator.",
  MFA_INVALID: "Kode MFA tidak valid. Periksa kode terbaru lalu coba kembali.",
  MFA_RECOVERY_CODE_INVALID: "Kode pemulihan tidak valid atau sudah digunakan.",
  LOGIN_RATE_LIMITED: "Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.",
};

const WORKSPACE_LABEL: Record<FieldWorkspace, { title: string; desc: string }> = {
  driver: { title: "Driver", desc: "Tugas perjalanan, GPS, dan bukti pengiriman" },
  recipient: { title: "Penerima", desc: "Pengiriman ke lokasi Anda dan konfirmasi penerimaan" },
};

function SessionNotice() {
  const params = useSearchParams();
  if (params.get("expired") !== "1") return null;
  return <Banner tone="info">Sesi Anda berakhir atau tidak ditemukan. Silakan masuk kembali.</Banner>;
}

export default function FieldLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<FieldWorkspace[] | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    // Memakai fetch langsung (bukan apiMutate) agar kode error seperti MFA_REQUIRED
    // tetap terbaca walaupun server membalas 401.
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include", cache: "no-store" });
      if (!csrfResponse.ok) throw new Error("CSRF_UNAVAILABLE");
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfToken) throw new Error("CSRF_UNAVAILABLE");

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(needsMfa && !useRecovery && otpCode ? { otpCode: otpCode.trim() } : {}),
          ...(needsMfa && useRecovery && recoveryCode ? { recoveryCode: recoveryCode.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string };
        const code = payload.code ?? "";
        if (code === "MFA_REQUIRED" || code === "MFA_INVALID" || code === "MFA_RECOVERY_CODE_INVALID") setNeedsMfa(true);
        if (LOGIN_ERRORS[code]) setError(LOGIN_ERRORS[code]);
        else if (response.status >= 500) setError("Layanan autentikasi belum dapat memeriksa akun. Coba lagi beberapa saat.");
        else setError("Username atau kata sandi tidak valid.");
        setLoading(false);
        return;
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error && loginError.message === "CSRF_UNAVAILABLE"
          ? safeErrorMessage(loginError)
          : "Layanan login tidak dapat dijangkau. Periksa koneksi lalu coba lagi.",
      );
      setLoading(false);
      return;
    }

    // Role/workspace ditentukan server dari membership, bukan dari pilihan client.
    try {
      const { workspaces } = await resolveWorkspaces();
      if (workspaces.length === 0) {
        await logoutField();
        setError("Akun Anda aktif tetapi belum terhubung ke workspace Driver atau Penerima. Hubungi administrator SPPG atau pengelola lokasi.");
      } else if (workspaces.length === 1) {
        router.replace(WORKSPACE_HOME[workspaces[0]]);
        router.refresh();
        return;
      } else {
        setChoices(workspaces);
      }
    } catch (resolveError) {
      setError(safeErrorMessage(resolveError));
    }
    setLoading(false);
  }

  return (
    <main className="field-login">
      <div className="field-login-card">
        <div className="field-login-brand">
          <span className="field-avatar" aria-hidden="true">R</span>
          <div>
            <h1>RADAR MBG</h1>
            <span className="field-caption">Field Operations</span>
          </div>
        </div>

        <Suspense fallback={null}>
          <SessionNotice />
        </Suspense>

        {choices ? (
          <div className="field-workspace-pick">
            <h2 className="field-section-title">Pilih workspace</h2>
            {choices.map((workspace) => (
              <button
                key={workspace}
                type="button"
                className="field-btn field-btn-block"
                style={{ justifyContent: "flex-start", minHeight: 64, textAlign: "left" }}
                onClick={() => router.replace(WORKSPACE_HOME[workspace])}
              >
                {workspace === "driver" ? <Truck size={20} aria-hidden="true" /> : <Package size={20} aria-hidden="true" />}
                <span>
                  <strong style={{ display: "block" }}>{WORKSPACE_LABEL[workspace].title}</strong>
                  <span className="field-caption">{WORKSPACE_LABEL[workspace].desc}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form className="field-form" onSubmit={submit} noValidate>
            {error && <Banner tone="danger">{error}</Banner>}

            <label className="field-field">
              <span>Username atau email</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
                disabled={loading}
              />
            </label>

            <label className="field-field">
              <span>Kata sandi</span>
              <div className="field-pw">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </label>

            {needsMfa && (
              <>
                <label className="field-field">
                  <span>{useRecovery ? "Kode pemulihan" : "Kode MFA"}</span>
                  <input
                    type="text"
                    value={useRecovery ? recoveryCode : otpCode}
                    onChange={(e) => (useRecovery ? setRecoveryCode(e.target.value) : setOtpCode(e.target.value))}
                    inputMode={useRecovery ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    disabled={loading}
                  />
                </label>
                <button type="button" className="field-btn" data-variant="ghost" onClick={() => setUseRecovery((v) => !v)}>
                  {useRecovery ? "Gunakan kode MFA" : "Gunakan kode pemulihan"}
                </button>
              </>
            )}

            <button type="submit" className="field-btn field-btn-block" data-variant="primary" disabled={loading || !username || !password}>
              {loading ? "Memproses..." : "Masuk"}
            </button>
            <p className="field-hint" style={{ margin: 0 }}>
              Gunakan akun yang diberikan administrator SPPG atau pengelola lokasi. Lupa kata sandi? Hubungi administrator Anda.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
