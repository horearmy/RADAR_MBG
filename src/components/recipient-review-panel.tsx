"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Smile, Star } from "lucide-react";
import { apiGet, getCurrentSession, isPlatformAdmin } from "@/lib/api";

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

type TenantOption = { id: string; tenantCode: string; name: string };

const reviewDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export function RecipientReviewPanel() {
  const [authState, setAuthState] = useState<"checking" | "ready" | "denied">("checking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [recent, setRecent] = useState<RecentReview[]>([]);
  const [tenantFilter, setTenantFilter] = useState("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    let active = true;
    void getCurrentSession()
      .then((session) => {
        if (!active) return;
        if (!isPlatformAdmin(session)) {
          setAuthState("denied");
          setLoading(false);
          return;
        }
        setAuthState("ready");
      })
      .catch(() => {
        if (!active) return;
        setAuthState("denied");
        setError("Sesi tidak dapat diverifikasi.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tenantFilter) params.set("tenantId", tenantFilter);
      const query = params.toString();
      const suffix = query ? `?${query}` : "";
      const [summaryData, recentData, tenantData] = await Promise.all([
        apiGet<ReviewSummary>(`/platform/recipient-reviews/summary${suffix}`),
        apiGet<RecentReview[]>(`/platform/recipient-reviews/recent${suffix}`),
        apiGet<TenantOption[]>("/platform/tenants"),
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
    if (authState !== "ready") return;
    void load();
  }, [authState, load]);

  if (authState === "denied") {
    return (
      <div className="table-state" role="status">
        {error || "Halaman ini hanya untuk administrator platform."}
      </div>
    );
  }

  const maxDistribution = Math.max(1, ...(summary?.distribution.map((entry) => entry.count) ?? [1]));

  return (
    <div className="review-content">
      <div className="review-toolbar">
        <label className="review-filter">
          <span>Filter tenant</span>
          <select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}>
            <option value="">Semua tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.tenantCode} · {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : undefined} /> Muat ulang
        </button>
      </div>

      {error && <div className="table-state error" role="alert">{error}</div>}

      {loading && !summary ? (
        <div className="table-state" role="status">Memuat data review…</div>
      ) : summary ? (
        <>
          <section className="kpi-grid kpi-grid-3 review-summary-grid" aria-label="Ringkasan review penerima">
            <article className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-icon icon-navy"><MessageSquare size={17} /></span>
                <span className="kpi-trend trend-neutral">Total</span>
              </div>
              <p className="kpi-label">Total Review</p>
              <div className="kpi-value">{summary.total}</div>
              <div className="kpi-foot">{recent.length} review terbaru ditampilkan</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-icon icon-amber"><Star size={17} /></span>
                <span className="kpi-trend trend-neutral">Rating</span>
              </div>
              <p className="kpi-label">Rata-rata Rating</p>
              <div className="kpi-value">{summary.averageRating}<span className="unit">/ 5</span></div>
              <div className="kpi-foot">Dari seluruh review masuk</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-icon icon-green"><Smile size={17} /></span>
                <span className="kpi-trend trend-neutral">Emoji</span>
              </div>
              <p className="kpi-label">Emoji Terbanyak</p>
              <div className="kpi-value">{summary.emojis[0]?.emoji ?? "—"}</div>
              <div className="kpi-foot">{summary.emojis[0] ? `${summary.emojis[0].count} kali dipilih` : "Belum ada emoji"}</div>
            </article>
          </section>

          <section className="review-block" aria-label="Distribusi rating">
            <div className="review-block-head">
              <h3>Distribusi Rating</h3>
              <p>Jumlah review per rating bintang.</p>
            </div>
            <div className="review-bars">
              {summary.distribution.map((entry) => (
                <div key={entry.rating} className="review-bar-row">
                  <span className="review-bar-label">{entry.rating} <Star size={12} /></span>
                  <div className="review-bar-track">
                    <span className="review-bar-fill" style={{ width: `${(entry.count / maxDistribution) * 100}%` }} />
                  </div>
                  <span className="review-bar-count">{entry.count}</span>
                </div>
              ))}
              {!summary.distribution.length && <p className="table-empty">Belum ada data distribusi rating.</p>}
            </div>
            {summary.emojis.length > 0 && (
              <div className="review-emoji-row" aria-label="Emoji yang dipilih">
                {summary.emojis.slice(0, 8).map((entry) => (
                  <span key={entry.emoji} className="review-emoji-chip">
                    <span aria-hidden="true">{entry.emoji}</span>
                    <strong>{entry.count}</strong>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="review-block" aria-label="Review per tenant">
            <div className="review-block-head">
              <h3>Review per Tenant</h3>
              <p>Rata-rata rating per tenant.</p>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>TENANT</th><th>NAMA</th><th>JUMLAH</th><th>RATA-RATA</th></tr>
                </thead>
                <tbody>
                  {summary.tenants.length === 0 && <tr><td colSpan={4} className="empty-row">Belum ada review</td></tr>}
                  {summary.tenants.map((tenant) => (
                    <tr key={tenant.tenantId}>
                      <td className="mono">{tenant.tenantCode}</td>
                      <td>{tenant.name}</td>
                      <td>{tenant.total}</td>
                      <td>{tenant.averageRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="review-block" aria-label="Review terbaru">
            <div className="review-block-head">
              <h3>Review Terbaru</h3>
              <p>{recent.length} review · waktu Asia/Jakarta (WIB)</p>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>TANGGAL</th><th>TENANT</th><th>PENERIMA</th><th>RATING</th><th>EMOJI</th><th>KOMENTAR</th></tr>
                </thead>
                <tbody>
                  {recent.length === 0 && <tr><td colSpan={6} className="empty-row">Belum ada review</td></tr>}
                  {recent.map((review) => (
                    <tr key={review.id}>
                      <td>{reviewDateFormatter.format(new Date(review.createdAt))} WIB</td>
                      <td>{review.tenantCode ?? "-"}</td>
                      <td>{review.userName ?? "-"}</td>
                      <td>{review.rating} <Star size={12} /></td>
                      <td>{review.emoji ?? "-"}</td>
                      <td className="review-comment">{review.comment ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
