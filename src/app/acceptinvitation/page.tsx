'use client';
import { useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function AcceptInvitationPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (password.length < 8) { setError('Password minimal 8 karakter.'); return; }
    if (password !== confirm) { setError('Konfirmasi password tidak cocok.'); return; }
    setSaving(true);
    try {
      const csrf = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
      const res = await fetch(`${apiBase}/auth/account-access/consume`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) throw new Error(`Gagal (${res.status})`);
      setMsg('Akun aktif. Silakan login.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7FB', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 12px 40px rgba(7,27,58,.12)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 650, color: '#15243a' }}>Terima Undangan</h1>
        <p style={{ margin: '0 0 16px', color: '#62728a', fontSize: 13 }}>Masukkan token undangan dan buat password untuk mengaktifkan akun Anda.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <textarea className="date-button" placeholder="Token undangan" value={token} onChange={(e) => setToken(e.target.value)} required rows={3} />
          <input type="password" className="date-button" placeholder="Password baru (min. 8 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input type="password" className="date-button" placeholder="Konfirmasi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button type="submit" disabled={saving} className="export-button" style={{ justifyContent: 'center' }}>
            {saving ? 'Memproses...' : 'Aktifkan Akun'}
          </button>
          {error && <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>}
          {msg && <p style={{ color: '#16a765', margin: 0 }}>{msg} <a href="/login" style={{ color: '#1677FF' }}>Login</a></p>}
        </form>
      </div>
    </div>
  );
}
