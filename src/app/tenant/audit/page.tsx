'use client';
import { useEffect, useState } from 'react';
const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? 'http://localhost:4000/api/v1';

export default function TenantAuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${apiBase}/tenant/audit`, { credentials: 'include' }).then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : []));
  }, []);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Audit Aktivitas</h1>
      <table className="w-full bg-white border text-sm">
        <thead className="bg-gray-50"><tr><th>Waktu</th><th>Aksi</th><th>Entitas</th><th>Hasil</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{new Date(r.createdAt).toLocaleString('id-ID')}</td>
              <td className="p-2">{r.action}</td>
              <td className="p-2">{r.entityType}:{r.entityId}</td>
              <td className="p-2">{r.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
