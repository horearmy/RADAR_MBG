"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, ShieldCheck, QrCode, Eye, EyeOff } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import {
  beginMfaEnrollment,
  beginMfaRotation,
  confirmMfaEnrollment,
  confirmMfaRotation,
  getCurrentSession,
  type SessionUser,
} from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";

export default function MfaEnrollmentPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [secret, setSecret] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [currentFactor, setCurrentFactor] = useState("");
  const [rotationOtp, setRotationOtp] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [useRecoveryFactor, setUseRecoveryFactor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    let active = true;
    void getCurrentSession().then((current) => {
      if (active) setUser(current);
    }).catch((loadError: unknown) => {
      if (!active) return;
      if (loadError instanceof Error && loadError.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
      } else {
        setError("Sesi tidak dapat diverifikasi.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function startEnrollment() {
    setBusy(true);
    setError("");
    setShowQr(false);
    try {
      const result = await beginMfaEnrollment();
      setSecret(result.secret);
      setNotice("Scan QR code ini dengan aplikasi authenticator Anda (Google Authenticator, Microsoft Authenticator, dll).");
    } catch {
      setError("Pembuatan enrollment gagal. MFA mungkin sudah aktif atau layanan tidak tersedia.");
    } finally {
      setBusy(false);
    }
  }

  function getOtpauthUrl(): string {
    if (!secret || !user) return "";
    const issuer = "RADAR MBG";
    const label = `${issuer}:${user.username}`;
    const params = new URLSearchParams({
      secret: secret,
      issuer: issuer,
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }

  async function finishEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!secret || !/^\d{6}$/.test(otpCode)) return;
    setBusy(true);
    setError("");
    try {
      const result = await confirmMfaEnrollment({ secret, otpCode });
      setUser((current) => current ? { ...current, mfaEnabled: true } : current);
      setRecoveryCodes(result.recoveryCodes);
      setSecret("");
      setOtpCode("");
      setNotice("MFA berhasil diaktifkan. Simpan akses authenticator Anda dengan aman.");
    } catch {
      setError("Kode tidak valid atau enrollment tidak dapat diselesaikan. Periksa waktu authenticator dan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function startRotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentFactor) return;
    setBusy(true);
    setError("");
    try {
      const result = await beginMfaRotation(useRecoveryFactor
        ? { recoveryCode: currentFactor.trim() }
        : { otpCode: currentFactor });
      setSecret(result.secret);
      setNotice(`Konfirmasi authenticator baru sebelum ${new Date(result.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch {
      setError("Faktor MFA lama tidak valid atau rotasi tidak dapat dimulai.");
    } finally {
      setBusy(false);
    }
  }

  async function finishRotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await confirmMfaRotation({ otpCode: rotationOtp });
      setRecoveryCodes(result.recoveryCodes);
      setSecret("");
      setCurrentFactor("");
      setRotationOtp("");
      setNotice(`Rotasi berhasil. ${result.sessionsRevoked} sesi dicabut; login kembali menggunakan authenticator baru.`);
    } catch {
      setError("Kode authenticator baru tidak valid atau waktu rotasi telah habis.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="session-state"><span className="session-spinner" /><p>Memeriksa sesi…</p></main>;
  if (!user) return <main className="session-state"><span className="session-error-mark">!</span><h1>Sesi tidak tersedia</h1><p>{error || "Silakan masuk untuk mengatur MFA."}</p><Link className="session-retry" href="/login">Masuk</Link></main>;

  return (
    <main className="approval-page">
      <header className="approval-topbar">
        <Link href="/" className="approval-back"><ArrowLeft size={15} /> Dashboard</Link>
        <div className="approval-brand"><span className="brand-mark"><span /><span /><span /></span><strong>RADAR<span>MBG</span></strong></div>
        <HeaderAccount user={user} />
      </header>
      <div className="mfa-content">
        <div className="approval-heading"><div className="approval-heading-icon"><ShieldCheck size={19} /></div><div><div className="eyebrow"><span className="eyebrow-line" />KEAMANAN AKUN</div><h1>Autentikasi multifaktor</h1><p>Gunakan aplikasi authenticator yang mendukung TOTP 6 digit.</p></div></div>
        {notice && <div className="approval-notice" role="status"><CheckCircle2 size={15} />{notice}</div>}
        {error && <div className="approval-error" role="alert">{error}</div>}
        <section className="panel mfa-panel">
          {recoveryCodes.length > 0 && <div className="mfa-recovery-block"><h2>Simpan kode pemulihan</h2><p>Kode hanya ditampilkan sekali. Simpan di tempat aman; tiap kode hanya dapat digunakan satu kali.</p><div className="mfa-recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="approval-button approve" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))} type="button"><Copy size={14} /> Salin semua kode</button><button className="approval-button reject" onClick={() => setRecoveryCodes([])} type="button">Saya sudah menyimpannya</button></div>}
          {user.mfaEnabled ? <>
            {!secret ? <div className="mfa-rotation-start"><div className="mfa-enabled"><CheckCircle2 size={22} /><strong>MFA aktif</strong><span>Anda dapat menyiapkan authenticator pengganti. Sesi lain akan dicabut setelah rotasi selesai.</span></div><form className="mfa-confirm" onSubmit={startRotation}><label htmlFor="current-mfa-factor">{useRecoveryFactor ? "Kode pemulihan yang belum digunakan" : "Kode authenticator saat ini"}</label><input autoComplete="one-time-code" id="current-mfa-factor" inputMode={useRecoveryFactor ? "text" : "numeric"} maxLength={useRecoveryFactor ? 32 : 6} onChange={(event) => setCurrentFactor(useRecoveryFactor ? event.target.value : event.target.value.replace(/\D/g, ""))} required value={currentFactor} /><button className="login-recovery-toggle" onClick={() => { setUseRecoveryFactor((value) => !value); setCurrentFactor(""); }} type="button">{useRecoveryFactor ? "Gunakan authenticator" : "Authenticator hilang? Gunakan kode pemulihan"}</button><button className="approval-button approve" disabled={busy || (useRecoveryFactor ? currentFactor.trim().length < 16 : currentFactor.length !== 6)} type="submit">{busy ? "Memverifikasi…" : "Mulai rotasi MFA"}</button></form></div> : <form className="mfa-confirm" onSubmit={finishRotation}><label htmlFor="mfa-secret">Secret authenticator baru</label><div className="mfa-secret-row"><code id="mfa-secret">{secret}</code><button aria-label="Salin secret" onClick={() => void navigator.clipboard.writeText(secret)} type="button"><Copy size={14} /></button></div><p>Tambahkan secret ke authenticator baru lalu konfirmasi kode 6 digit.</p><label htmlFor="mfa-rotation-otp">Kode authenticator baru</label><input autoComplete="one-time-code" id="mfa-rotation-otp" inputMode="numeric" maxLength={6} onChange={(event) => setRotationOtp(event.target.value.replace(/\D/g, ""))} pattern="\d{6}" required value={rotationOtp} /><button className="approval-button approve" disabled={busy || rotationOtp.length !== 6} type="submit">{busy ? "Memverifikasi…" : "Konfirmasi rotasi"}</button></form>}
          </> : !secret ? (
            <div className="mfa-start"><h2>Daftarkan authenticator</h2><p>RADAR akan menampilkan secret dan QR code satu kali. Scan QR atau tambahkan secret ke authenticator Anda.</p><button className="approval-button approve" disabled={busy} onClick={() => void startEnrollment()} type="button">{busy ? "Menyiapkan…" : "Mulai pendaftaran"}</button></div>
          ) : (
            <form className="mfa-confirm" onSubmit={finishEnrollment}>
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="approval-button approve"
                  style={{ justifyContent: "center" }}
                >
                  {showQr ? <EyeOff size={16} /> : <QrCode size={16} />}
                  {showQr ? "Sembunyikan QR Code" : "Tampilkan QR Code"}
                </button>
              </div>
              
              {showQr && secret && (
                <div style={{ textAlign: "center", marginBottom: "1rem", padding: "1rem", background: "#f9fafb", borderRadius: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
                    <QRCodeSVG value={getOtpauthUrl()} size={200} level="M" />
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                    Scan QR ini dengan aplikasi authenticator Anda
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {user.username} • RADAR MBG
                  </p>
                </div>
              )}
              
              <label htmlFor="mfa-secret">Secret authenticator</label>
              <div className="mfa-secret-row"><code id="mfa-secret">{secret}</code><button aria-label="Salin secret" onClick={() => void navigator.clipboard.writeText(secret)} type="button"><Copy size={14} /></button></div>
              <p>Tambahkan secret atau scan QR code di atas dengan akun <strong>{user.username}</strong>, lalu masukkan kode 6 digit yang sedang aktif.</p>
              
              <label htmlFor="mfa-otp">Kode verifikasi</label>
              <input autoComplete="one-time-code" id="mfa-otp" inputMode="numeric" maxLength={6} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))} pattern="\d{6}" placeholder="000000" required value={otpCode} />
              <button className="approval-button approve" disabled={busy || otpCode.length !== 6} type="submit">{busy ? "Memverifikasi…" : "Aktifkan MFA"}</button>
            </form>
          )}
        </section>
      </div>
      {/* QR scanner modal removed */}
    </main>
  );
}
