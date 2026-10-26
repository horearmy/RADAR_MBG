"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, ShieldCheck } from "lucide-react";
import { beginMfaRecovery, confirmMfaRecovery } from "@/lib/api";

export default function MfaRecoveryPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [username, setUsername] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await beginMfaRecovery({ token: token.trim(), password });
      setSecret(result.secret);
    } catch {
      setError("Token atau password tidak valid, kedaluwarsa, atau pemulihan tidak tersedia.");
    } finally {
      setBusy(false);
    }
  }

  async function finishRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await confirmMfaRecovery({ token: token.trim(), password, otpCode });
      setUsername(result.username);
      setRecoveryCodes(result.recoveryCodes);
      setSecret("");
      setOtpCode("");
      setToken("");
      setPassword("");
    } catch {
      setError("Kode authenticator tidak valid atau token pemulihan sudah tidak dapat digunakan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-access-page">
      <section className="account-access-card mfa-recovery-card">
        <div className="approval-brand"><span className="brand-mark"><span /><span /><span /></span><strong>RADAR<span>MBG</span></strong></div>
        <div className="account-access-icon"><ShieldCheck size={20} /></div>
        {recoveryCodes.length ? <>
          <div className="eyebrow"><span className="eyebrow-line" />PEMULIHAN SELESAI</div>
          <h1>MFA aktif kembali</h1>
          <p>Akun {username}. Simpan kode pemulihan ini sekarang; setiap kode hanya dapat dipakai satu kali dan tidak dapat ditampilkan kembali.</p>
          <div className="mfa-recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
          <button className="approval-button approve" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))} type="button"><Copy size={14} /> Salin semua kode</button>
          <Link className="approval-button approve account-access-link" href="/login">Lanjut ke login</Link>
        </> : secret ? <>
          <div className="eyebrow"><span className="eyebrow-line" />KONFIGURASI AUTHENTICATOR</div>
          <h1>Daftarkan authenticator baru</h1>
          <p>Tambahkan secret ini ke aplikasi authenticator. Setelah konfirmasi, sesi akun akan diminta login kembali.</p>
          {error && <div className="approval-error" role="alert">{error}</div>}
          <div className="mfa-secret-row"><code>{secret}</code><button aria-label="Salin secret" onClick={() => void navigator.clipboard.writeText(secret)} type="button"><Copy size={14} /></button></div>
          <form className="account-access-form" onSubmit={finishRecovery}>
            <label htmlFor="mfa-recovery-otp">Kode authenticator 6 digit</label>
            <input autoComplete="one-time-code" id="mfa-recovery-otp" inputMode="numeric" maxLength={6} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))} pattern="\d{6}" required value={otpCode} />
            <button className="approval-button approve" disabled={busy || otpCode.length !== 6} type="submit">{busy ? "Memverifikasi…" : "Aktifkan MFA baru"}</button>
          </form>
        </> : <>
          <div className="eyebrow"><span className="eyebrow-line" />PEMULIHAN MFA</div>
          <h1>Pulihkan akses MFA</h1>
          <p>Masukkan token pemulihan sekali pakai dari administrator dan password akun. Token berlaku 30 menit.</p>
          {error && <div className="approval-error" role="alert">{error}</div>}
          <form className="account-access-form" onSubmit={startRecovery}>
            <label htmlFor="mfa-reset-token">Token pemulihan</label>
            <input autoComplete="one-time-code" id="mfa-reset-token" maxLength={128} onChange={(event) => setToken(event.target.value)} required value={token} />
            <label htmlFor="mfa-reset-password">Password akun</label>
            <input autoComplete="current-password" id="mfa-reset-password" maxLength={128} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            <button className="approval-button approve" disabled={busy || token.trim().length < 32 || !password} type="submit">{busy ? "Memeriksa…" : "Lanjutkan pemulihan"}</button>
          </form>
        </>}
        {!recoveryCodes.length && <Link className="account-access-back" href="/login">Kembali ke halaman login</Link>}
      </section>
    </main>
  );
}
