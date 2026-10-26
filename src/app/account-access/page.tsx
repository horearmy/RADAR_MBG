"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { consumeAccountToken } from "@/lib/api";

export default function AccountAccessPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [purpose, setPurpose] = useState<"INVITATION" | "PASSWORD_RESET" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    if (password.length < 14) {
      setError("Password harus terdiri dari minimal 14 karakter.");
      return;
    }
    setBusy(true);
    try {
      const result = await consumeAccountToken({ token: token.trim(), password });
      setUsername(result.username);
      setPurpose(result.purpose);
      setToken("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Token tidak valid, kedaluwarsa, sudah digunakan, atau password tidak memenuhi aturan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-access-page">
      <section className="account-access-card">
        <div className="approval-brand"><span className="brand-mark"><span /><span /><span /></span><strong>RADAR<span>MBG</span></strong></div>
        <div className="account-access-icon">{purpose ? <ShieldCheck size={20} /> : <KeyRound size={20} />}</div>
        {purpose ? <>
          <div className="eyebrow"><span className="eyebrow-line" />AKUN SIAP</div>
          <h1>{purpose === "INVITATION" ? "Undangan diterima" : "Password diperbarui"}</h1>
          <p>{purpose === "INVITATION" ? `Password untuk ${username} sudah ditetapkan. Silakan masuk ke RADAR MBG.` : `Password akun ${username} berhasil diubah. Sesi lain telah dicabut.`}</p>
          <Link className="approval-button approve account-access-link" href="/login">Lanjut ke login</Link>
        </> : <>
          <div className="eyebrow"><span className="eyebrow-line" />UNDANGAN · PEMULIHAN AKUN</div>
          <h1>Atur akses akun</h1>
          <p>Masukkan token satu kali dari administrator dan buat password baru minimal 14 karakter.</p>
          {error && <div className="approval-error" role="alert">{error}</div>}
          <form className="account-access-form" onSubmit={submit}>
            <label htmlFor="account-token">Token akses</label>
            <input autoComplete="one-time-code" id="account-token" maxLength={128} onChange={(event) => setToken(event.target.value)} required value={token} />
            <label htmlFor="new-password">Password baru</label>
            <input autoComplete="new-password" id="new-password" maxLength={128} minLength={14} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            <label htmlFor="confirm-password">Ulangi password</label>
            <input autoComplete="new-password" id="confirm-password" maxLength={128} minLength={14} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
            <button className="approval-button approve" disabled={busy || token.trim().length < 32 || password.length < 14 || password !== confirmPassword} type="submit">{busy ? "Memproses…" : "Simpan password"}</button>
          </form>
        </>}
        <Link className="account-access-back" href="/login">Kembali ke halaman login</Link>
      </section>
    </main>
  );
}
