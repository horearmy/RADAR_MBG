'use client';
import { useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function RegistrationStatusPage() {
  const [number, setNumber] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/public/sppg-registrations/status/${number}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (err: any) { setError(err.message); }
  }

  return (
    <div className="p-6 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Cek Status Pendaftaran</h1>
      <form onSubmit={check} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="Nomor Registrasi" value={number} onChange={(e) => setNumber(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Cek</button>
      </form>
      {error && <p className="text-red-600 mt-2">{error}</p>}
      {result && <pre className="mt-4 bg-gray-100 p-4 rounded">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
