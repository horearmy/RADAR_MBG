"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, QrCode, RefreshCw, UserRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import mobileBg from "@/bg/mobile.webp";
import { HeaderAccount } from "@/components/account-menu";
import { TenantSidebar } from "@/components/tenant-sidebar";
import {
  apiBaseUrl,
  apiFetch,
  getCurrentSession,
  getSelectedTenantId,
  hasPermission,
  type SessionUser,
} from "@/lib/api";

type RegistrationCode = { id: string; code: string; active: boolean; createdAt: string };
type RecipientSite = { id: string; name: string; code: string };
type RegistrationRequest = {
  id: string;
  requesterName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  requestedSiteName?: string | null;
  notes?: string | null;
  status: string;
  reviewNotes?: string | null;
  approvedRecipientSiteId?: string | null;
  createdAt: string;
};

export default function TenantRecipientRegistrationsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [sites, setSites] = useState<RecipientSite[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewSiteId, setReviewSiteId] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const selectedTenantId = getSelectedTenantId();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getCurrentSession();
      setUser(session);
      if (!hasPermission(session, "tenant:manage")) {
        setError("Akses terbatas.");
        setLoading(false);
        return;
      }
      const [codesRes, sitesRes, requestsRes] = await Promise.all([
        apiFetch("/tenant/recipient-registrations/codes", { credentials: "include" }).catch(() => null),
        apiFetch("/tenant/recipient-registrations/sites", { credentials: "include" }),
        apiFetch("/tenant/recipient-registrations", { credentials: "include" }),
      ]);
      // codes endpoint may not exist; ignore if unavailable
      if (codesRes?.ok) setCodes(await codesRes.json().catch(() => []));
      if (sitesRes.ok) setSites(await sitesRes.json().catch(() => []));
      if (requestsRes.ok) setRequests(await requestsRes.json().catch(() => []));
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createCode = async () => {
    setCreatingCode(true);
    setCodeError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const csrf = await csrfRes.json().catch(() => null);
      if (!csrfRes.ok || !csrf?.csrfToken) throw new Error("Gagal memulai sesi keamanan.");
      const res = await apiFetch("/tenant/recipient-registrations/codes", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf.csrfToken },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Gagal membuat kode");
      }
      const code = await res.json();
      setCodes((prev) => [code, ...prev]);
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Gagal membuat kode");
    } finally {
      setCreatingCode(false);
    }
  };

  const review = async (id: string, decision: "APPROVE" | "REJECT" | "REVISION_REQUIRED") => {
    setReviewingId(id);
    setReviewError(null);
    try {
      const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
      const csrf = await csrfRes.json().catch(() => null);
      if (!csrfRes.ok || !csrf?.csrfToken) throw new Error("Gagal memulai sesi keamanan.");
      const body: Record<string, unknown> = { decision, reviewNotes: reviewNotes.trim() || undefined };
      if (decision === "APPROVE") {
        if (!reviewSiteId) throw new Error("Pilih lokasi penerima.");
        body.recipientSiteId = reviewSiteId;
      }
      const res = await apiFetch(`/tenant/recipient-registrations/${id}/${decision === "APPROVE" ? "approve" : decision === "REJECT" ? "reject" : "request-revision"}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.csrfToken },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Gagal meninjau");
      }
      const result = await res.json().catch(() => null);
      if (result?.invitationToken) {
        alert(`Disetujui. Username: ${result.adminUsername}\\nToken aktivasi: ${result.invitationToken}`);
      }
      setReviewSiteId("");
      setReviewNotes("");
      await load();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Gagal meninjau");
    } finally {
      setReviewingId(null);
    }
  };

  const downloadQr = (code: string) => {
    const container = document.getElementById(`qr-${code}`);
    const svg = container?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const qrUrl = URL.createObjectURL(svgBlob);

    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    bgImg.src = mobileBg.src;

    bgImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background
      ctx.drawImage(bgImg, 0, 0);

      // Overlay
      ctx.fillStyle = "rgba(7, 27, 58, 0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // White card
      const cardW = 520;
      const cardH = 620;
      const cardX = (canvas.width - cardW) / 2;
      const cardY = (canvas.height - cardH) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 24);
      ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.fill();
      ctx.shadowColor = "transparent";

      // Title
      ctx.fillStyle = "#071B3A";
      ctx.font = "bold 28px Inter, system-ui, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Pendaftaran Penerima", canvas.width / 2, cardY + 50);

      // Subtitle
      ctx.fillStyle = "#5B6B82";
      ctx.font = "14px Inter, system-ui, Arial, sans-serif";
      ctx.fillText("Scan QR ini untuk mendaftar", canvas.width / 2, cardY + 80);

      // QR
      const qrImg = new Image();
      qrImg.onload = () => {
        const qrSize = 360;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = cardY + 120;
        // white quiet zone
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // Code
        ctx.fillStyle = "#172B4D";
        ctx.font = "bold 16px monospace";
        ctx.fillText(code, canvas.width / 2, qrY + qrSize + 40);

        // Footer
        ctx.fillStyle = "#718096";
        ctx.font = "12px Inter, system-ui, Arial, sans-serif";
        ctx.fillText("RADAR MBG · Field Operations", canvas.width / 2, cardY + cardH - 30);

        URL.revokeObjectURL(qrUrl);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `qr-${code}.png`;
        a.click();
      };
      qrImg.src = qrUrl;
    };
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="app-shell">
      <TenantSidebar />
      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Tenant</span><ChevronRight size={14} /><strong>Registrasi Penerima</strong></div>
          <div className="topbar-actions"><HeaderAccount user={user} /></div>
        </header>
        <div className="content-area">
          <div className="page">
            <header className="page-hero">
              <div>
                <p className="page-breadcrumb">Tenant &gt; Pengguna &gt; Registrasi Penerima</p>
                <h1 className="page-title">Registrasi Penerima</h1>
                <p className="page-subtitle">Buat QR pendaftaran dan tinjau permintaan penerima.</p>
              </div>
              <div className="page-actions">
                <button className="btn btn-primary" onClick={createCode} disabled={creatingCode}>
                  <QrCode size={16} /> {creatingCode ? "Membuat..." : "Buat QR Pendaftaran"}
                </button>
              </div>
            </header>

            {codeError && <div className="panel"><p className="text-secondary">{codeError}</p></div>}
            {error && <div className="panel"><p className="text-secondary">{error}</p></div>}

            {codes.length > 0 && (
              <section className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header">
                  <div>
                    <h2>Kode Pendaftaran Penerima</h2>
                    <p>Tempel QR ini di lokasi penerima.</p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 16 }}>
                  {codes.map((code) => (
                    <div key={code.id} style={{ display: "grid", gap: 8, padding: 12, border: "1px solid #DCE5F0", borderRadius: 12 }}>
                      <div id={`qr-${code.code}`} style={{ display: "flex", justifyContent: "center" }}>
                        <QRCodeSVG value={`${origin}/radarapp/register?code=${code.code}`} size={180} />
                      </div>
                      <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12 }}>{code.code}</div>
                      <div style={{ textAlign: "center", fontSize: 12, color: "#718096" }}>
                        Link: {origin}/radarapp/register?code={code.code}
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                        <button className="btn btn-ghost" type="button" onClick={() => void navigator.clipboard?.writeText(`${origin}/radarapp/register?code=${code.code}`)}>
                          Salin link
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => downloadQr(code.code)}>
                          Unduh QR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {loading && <div className="table-state">Memuat...</div>}

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Permintaan Pendaftaran Penerima</h2>
                  <p>{requests.length} permintaan</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pendaftar</th>
                      <th>Kontak</th>
                      <th>Lokasi Diminta</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.length === 0 && (
                      <tr><td colSpan={5} className="empty-row">Belum ada permintaan</td></tr>
                    )}
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.requesterName}</td>
                        <td>{r.contactEmail ?? r.contactPhone ?? "-"}</td>
                        <td>{r.requestedSiteName ?? "-"}</td>
                        <td><span className="pill pill-neutral">{r.status}</span></td>
                        <td>
                          {r.status === "PENDING_REVIEW" && (
                            <div style={{ display: "grid", gap: 6 }}>
                              <select value={reviewSiteId} onChange={(e) => setReviewSiteId(e.target.value)}>
                                <option value="">Pilih lokasi penerima</option>
                                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Catatan (opsional)" />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-success" disabled={reviewingId === r.id} onClick={() => review(r.id, "APPROVE")}>Setujui</button>
                                <button className="btn btn-danger" disabled={reviewingId === r.id} onClick={() => review(r.id, "REJECT")}>Tolak</button>
                                <button className="btn btn-warning" disabled={reviewingId === r.id} onClick={() => review(r.id, "REVISION_REQUIRED")}>Revisi</button>
                              </div>
                              {reviewError && <p style={{ color: "#ef4444", fontSize: 12 }}>{reviewError}</p>}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}