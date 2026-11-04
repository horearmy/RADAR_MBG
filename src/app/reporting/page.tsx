'use client';
import { useEffect, useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function ReportingPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/platform/summary`, { credentials: 'include' })
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reporting (Cross-tenant)</h1>
      <ul className="space-y-2">
        <li>Tenants: {data.tenants}</li>
        <li>Trips: {data.trips}</li>
        <li>Drivers: {data.drivers}</li>
      </ul>
    </div>
  );
}
