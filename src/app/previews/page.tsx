"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiBaseUrl, apiGet, getCurrentSession, isPlatformAdmin, type SessionUser } from "@/lib/api";

type ReviewSummary = {
  total: number;
  averageRating: number;
  distribution: Array<{ rating: number; count: number }>;
  emojis: Array<{ emoji: string; count: number }>;
  tenants: Array<{ tenantId: string; tenantCode: string; name: string; total: number; averageRating: number }>;
};

type RecentReview = {
  id: string;
  rating: number;
  emoji: string | null;
  comment: string | null;
  status: string;
  createdAt: string;
  tenantCode: string | null;
  tenantName: string | null;
  userName: string | null;
};

export default function PlatformReviewsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [recent, setRecent] = useState<RecentReview[]>([]);
  const [tenantFilter, setTenantFilter] = useState("");
  const [tenants, setTenants] = useState<Array<{ id: string; tenantCode: string; name: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tenantFilter) params.set("tenantId", tenantFilter);
      const [summaryData, recentData, tenantData] = await Promise.all([
        apiGet<ReviewSummary>(`/platform/recipient-reviews/summary?${params.toString()}`),
        apiGet<RecentReview[]>(`/platform/recipient-reviews/recent?${params.toString()}`),
        apiGet<Array<{ id: string; tenantCode: string; name: string }>>("/platform/tenants"),
      ]);
      setSummary(summaryData);
      setRecent(recentData);
      setTenants(tenantData);
    } catch {
      setError("Data review tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [tenantFilter]);

  useEffect(() => {
    let active = true;
    void getCurrentSession().then((session) => {
      if (!active) return;
      setUser(session);
      if (!isPlatformAdmin(session)) {
        setError("Halaman ini hanya untuk administrator platform.");
        setLoading(false);
        return;
      }
      void load();
    }).catch(() => {
      if (active) {
        setError("Sesi tidak dapat diverifikasi.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [load, tenantFilter]);

  const maxDistribution = Math.max(1, ...(summary?.distribution.map((d) => d.count) ?? [1]));

  return (
    <main className="platform-reviews-page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">PLATFORM / REVIEW PENERIMA</p>
          <h1 className="page-title">Review Penerima</h1>
          <p className="page-subtitle">Ringkasan rating, emoji, dan komentar penerima.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
            <option value="">Semua tenant</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenantCode} · {t.name}</option>)}
          </select>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Muat ulang</button>
        </div>
      </header>

      {error && <div className="table-state error" role="alert">{error}</div>}

      {loading ? <div className="table-state">Memuat data review…</div> : summary && (
        <>
          <section className="kpi-grid" style={{ marginBottom: 16 }}>
            <article className="kpi-card">
              <p className="kpi-label">Total Review</p>
              <div className="kpi-value">{summary.total}</div>
            </article>
            <article className="kpi-card">
              <p className="kpi-label">Rata-rata Rating</p>
              <div className="kpi-value">{summary.averageRating}</div>
            </article>
            <article className="kpi-card">
              <p className="kpi-label">Emoji Terbanyak</p>
              <div className="kpi-value">{summary.emojis[0]?.emoji ?? "-"}</div>
            </article>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div>
                <h2>Distribusi Rating</h2>
                <p>Jumlah review per rating</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, padding: 16 }}>
              {summary.distribution.map((d) => (
                <div key={d.rating} style={{ display: "grid", gridTemplateColumns: "40px 1fr 40px", alignItems: "center", gap: 8 }}>
                  <span>{d.rating} ★</span>
                  <div style={{ background: "#DCE5F0", borderRadius: 4, height: 16, overflow: "hidden" }}>
                    <div style={{ width: `${(d.count / maxDistribution) * 100}%`, background: "#1677FF", height: "100%" }} />
                  </div>
                  <span>{d.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div>
                <h2>Review per Tenant</h2>
                <p>Rata-rata rating per tenant</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>TENANT</th><th>NAMA</th><th>JUMLAH</th><th>RATA-RATA</th></tr></thead>
                <tbody>
                  {summary.tenants.length === 0 && <tr><td colSpan={4} className="empty-row">Belum ada review</td></tr>}
                  {summary.tenants.map((t) => (
                    <tr key={t.tenantId}>
                      <td className="mono">{t.tenantCode}</td>
                      <td>{t.name}</td>
                      <td>{t.total}</td>
                      <td>{t.averageRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Review Terbaru</h2>
                <p>{recent.length} review</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>TANGGAL</th><th>TENANT</th><th>PENERIMA</th><th>RATING</th><th>EMOJI</th><th>KOMENTAR</th></tr></thead>
                <tbody>
                  {recent.length === 0 && <tr><td colSpan={6} className="empty-row">Belum ada review</td></tr>}
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(r.createdAt))}</td>
                      <td>{r.tenantCode ?? "-"}</td>
                      <td>{r.userName ?? "-"}</td>
                      <td>{r.rating} ★</td>
                      <td>{r.emoji ?? "-"}</td>
                      <td>{r.comment ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}