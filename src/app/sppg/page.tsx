"use client";

import { useEffect, useState } from "react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

type Sppg = { id: string; code: string; name: string; status: string };

export default function SppgPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Sppg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!active) return;
        setUser(session);
        const res = await fetch(`${process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1"}/admin/sppg?page=1&pageSize=50`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? "Gagal memuat SPPG");
        if (active) setRows(json.data ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!user) return <main className="page"><p>Memuat...</p></main>;
  if (!hasPermission(user, "master:read") && !hasPermission(user, "sppg:read")) {
    return <main className="page"><p>Akses terbatas.</p></main>;
  }

  return (
    <main className="page">
      <h1>SPPG</h1>
      {loading && <p>Memuat...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <table>
          <thead><tr><th>Kode</th><th>Nama</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.status}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
