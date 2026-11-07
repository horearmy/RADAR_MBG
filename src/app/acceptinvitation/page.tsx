'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { apiBaseUrl } from "@/lib/api";
const apiBase = apiBaseUrl;

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) setToken(queryToken);
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (token.trim().length < 32) { setError('Token undangan tidak valid.'); return; }
    if (password.length < 14) { setError('Password minimal 14 karakter.'); return; }
    if (password !== confirm) { setError('Konfirmasi password tidak cocok.'); return; }
    setSaving(true);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' });
      const csrf = await csrfRes.json().catch(() => null);
      if (!csrfRes.ok || !csrf?.csrfToken) throw new Error('Gagal memulai sesi keamanan.');
      const res = await fetch(`${apiBase}/auth/account-access/consume`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        body: JSON.stringify({ token: token.trim(), password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? `Gagal (${res.status})`);
      setMsg('Akun aktif. Silakan login.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F4F7FB, #EAF2FF)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, padding: 32, boxShadow: '0 20px 60px rgba(7,27,58,.12)', animation: 'fadeIn .3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EAF2FF', display: 'grid', placeItems: 'center', color: '#1677FF' }}>
            <KeyRound size={28} />
          </div>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 650, color: '#15243a', textAlign: 'center' }}>Aktivasi Akun</h1>
        <p style={{ margin: '0 0 20px', color: '#62728a', fontSize: 13, textAlign: 'center' }}>Masukkan token undangan dan buat password untuk mengaktifkan akun Anda.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <textarea className="date-button" placeholder="Token undangan" value={token} onChange={(e) => setToken(e.target.value)} required rows={3} style={{ minHeight: 80, resize: 'vertical' }} />
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} className="date-button" placeholder="Password baru (min. 14 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, cursor: 'pointer', color: '#62728a' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input type="password" className="date-button" placeholder="Konfirmasi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button type="submit" disabled={saving} className="export-button" style={{ justifyContent: 'center', minHeight: 42, fontSize: 13, fontWeight: 650 }}>
            {saving ? 'Memproses...' : 'Aktifkan Akun'}
          </button>
          {error && <p style={{ color: '#ef4444', margin: 0, fontSize: 12 }}>{error}</p>}
          {msg && <p style={{ color: '#16a765', margin: 0, fontSize: 12 }}>{msg} <a href="/login" style={{ color: '#1677FF', fontWeight: 600 }}>Login</a></p>}
        </form>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: .6; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Memuat...</div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
