'use client';
import { useEffect, useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function TenantsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${apiBase}/platform/tenants`, { credentials: 'include' }).then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : []));
  }, []);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tenant (SPPG)</h1>
      <table className="w-full bg-white border text-sm">
        <thead className="bg-gray-50"><tr><th>Kode</th><th>Nama</th><th>Status</th><th>Legacy SPPG</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.tenantCode}</td>
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.legacySppgId ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
