'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function TenantPage() {
  const [me, setMe] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      fetch(`${apiBase}/tenant/me`, { credentials: 'include' }),
      fetch(`${apiBase}/tenant/summary`, { credentials: 'include' }),
    ]).then(async ([mr, sr]) => {
      if (!mr.ok || !sr.ok) throw new Error(mr.status === 403 ? 'Tenant tidak aktif atau ditangguhkan.' : `HTTP ${mr.status}`);
      const m = await mr.json();
      const s = await sr.json();
      setMe(m); setSummary(s);
    }).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!me || !summary) return <p>Memuat ringkasan operasional...</p>;
  const cards = [
    ['Perjalanan hari ini', summary.tripsToday, '/tenant/trips'],
    ['Sedang berjalan', summary.tripsActive, '/tenant/trips'],
    ['Selesai', summary.tripsDone, '/tenant/trips'],
    ['Driver aktif', summary.drivers, '/tenant/drivers'],
    ['Kendaraan aktif', summary.vehicles, '/tenant/vehicles'],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />WORKSPACE SPPG</div>
          <h1>{me.profile?.sppgName ?? me.name}</h1>
          <p>{me.tenantCode} · status {me.status}. Data ini hanya milik unit SPPG Anda.</p>
        </div>
      </div>
      <div className="kpi-grid">
        {cards.map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)} className="kpi-card">
            <div className="kpi-label">{label}</div>
            <div className="kpi-value">{value ?? 0}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
