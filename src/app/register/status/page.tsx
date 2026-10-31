'use client';
import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function RegistrationStatusPage() {
  const [number, setNumber] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${apiBase}/public/sppg-registrations/status/${number}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (s: string) => s === 'APPROVED' ? '#16A765' : s === 'REJECTED' ? '#EF4444' : s === 'REVISION_REQUIRED' ? '#F59E0B' : '#1677FF';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F4F7FB, #EAF2FF)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, padding: 32, boxShadow: '0 20px 60px rgba(7,27,58,.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EAF2FF', display: 'grid', placeItems: 'center', color: '#1677FF' }}>
            <ClipboardCheck size={28} />
          </div>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 650, color: '#15243a', textAlign: 'center' }}>Cek Status Pendaftaran</h1>
        <p style={{ margin: '0 0 20px', color: '#62728a', fontSize: 13, textAlign: 'center' }}>Masukkan nomor registrasi untuk melihat status.</p>
        <form onSubmit={check} style={{ display: 'grid', gap: 12 }}>
          <input className="date-button" placeholder="Nomor Registrasi (REG-...)" value={number} onChange={(e) => setNumber(e.target.value)} required />
          <button type="submit" disabled={loading} className="export-button" style={{ justifyContent: 'center', minHeight: 42 }}>
            {loading ? 'Memeriksa...' : 'Cek Status'}
          </button>
        </form>
        {error && <p style={{ color: '#EF4444', marginTop: 12 }}>{error}</p>}
        {result && (
          <div style={{ marginTop: 20, padding: 16, background: '#F8FAFC', borderRadius: 10, border: '1px solid #DCE4EF' }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Nomor:</strong> {result.registrationNumber}
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Status:</strong>{' '}
              <span style={{ color: statusColor(result.status), fontWeight: 600 }}>{result.status}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Submitted:</strong> {result.submittedAt ? new Date(result.submittedAt).toLocaleString('id-ID') : '-'}
            </div>
            {result.reviewedAt && (
              <div style={{ marginBottom: 8 }}>
                <strong>Reviewed:</strong> {new Date(result.reviewedAt).toLocaleString('id-ID')}
              </div>
            )}
            {result.reviewNotes && (
              <div>
                <strong>Catatan:</strong> {result.reviewNotes}
              </div>
            )}
          </div>
        )}
        <p style={{ marginTop: 16, fontSize: 12, color: '#62728a', textAlign: 'center' }}>
          Belum mendaftar? <a href="/register" style={{ color: '#1677FF', fontWeight: 600 }}>Daftar di sini</a>
        </p>
      </div>
    </div>
  );
}
