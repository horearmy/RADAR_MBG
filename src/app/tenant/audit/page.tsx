"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/api";

type AuditLog = { id: string; action: string; entityType: string; entityId: string | null; result: string; createdAt: string };

export default function TenantAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`${apiBaseUrl}/tenant/audit`, { credentials: "include" });
        if (!res.ok) throw new Error("Gagal memuat audit");
        const data = await res.json();
        if (!active) return;
        setLogs(Array.isArray(data) ? data : data.data ?? []);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (loading) return <main className="session-state"><span className="session-spinner" /><p>Memuat audit…</p></main>;
  if (error) return <main className="session-state"><span className="session-error-mark">!</span><h1>Gagal memuat</h1><p>{error}</p></main>;

  return (
    <div className="tenant-page">
      <h1 className="page-title">Audit Aktivitas</h1>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Waktu</th><th>Aksi</th><th>Entitas</th><th>Hasil</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}><td>{new Date(l.createdAt).toLocaleString("id-ID")}</td><td>{l.action}</td><td>{l.entityType}</td><td>{l.result}</td></tr>
            ))}
            {!logs.length && <tr><td colSpan={4} className="table-empty">Belum ada log audit.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}