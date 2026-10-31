"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCheck, Clock3, RefreshCw, X } from "lucide-react";
import { HeaderAccount } from "@/components/account-menu";
import {
  decideApprovalRequest,
  getApprovalInbox,
  getApprovalSppgs,
  getCurrentSession,
  getMyApprovalRequests,
  hasPermission,
  requestSppgStatusChange,
  type ApprovalRequestSummary,
  type ApprovalSppgOption,
  type SessionUser,
} from "@/lib/api";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Menunggu aktivasi",
    ACTIVE: "Aktif",
    SUSPENDED: "Ditangguhkan",
    ARCHIVED: "Diarsipkan",
    PENDING_APPROVAL: "Menunggu persetujuan",
    EXECUTED: "Dijalankan",
    REJECTED: "Ditolak",
    FAILED: "Gagal — objek berubah",
  };
  return labels[status] ?? status;
}

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "REQUEST_FAILED_403" || code === "FORBIDDEN") return "Akun Anda tidak memiliki izin untuk tindakan ini.";
  if (code === "REQUEST_FAILED_409") return "Data SPPG berubah atau sudah memiliki permintaan aktif. Muat ulang lalu coba lagi.";
  if (code === "SPPG_STATUS_CHANGE_REQUIRES_APPROVAL") return "Perubahan status SPPG harus diajukan melalui persetujuan.";
  if (code === "UNAUTHENTICATED") return "Sesi berakhir. Silakan masuk kembali.";
  return "Permintaan gagal diproses. Periksa koneksi lalu coba lagi.";
}

function ApprovalCard({
  request,
  reviewer,
  busy,
  decisionReason,
  onReasonChange,
  onDecision,
}: {
  request: ApprovalRequestSummary;
  reviewer: boolean;
  busy: boolean;
  decisionReason: string;
  onReasonChange: (value: string) => void;
  onDecision: (decision: "APPROVED" | "REJECTED") => void;
}) {
  const beforeStatus = request.payloadBefore?.status ?? "—";
  const afterStatus = request.payloadAfter.status ?? "—";
  const pending = request.status === "PENDING_APPROVAL";

  return (
    <article className="approval-card">
      <div className="approval-card-top">
        <div>
          <span className={`approval-status ${pending ? "pending" : "complete"}`}>
            <span />{statusLabel(request.status)}
          </span>
          <h2>Perubahan status SPPG{request.target ? ` · ${request.target.code} — ${request.target.name}` : ""}</h2>
          <p>{request.requestedByUser.displayName} · diajukan {formatDate(request.submittedAt)}</p>
        </div>
        <span className="approval-id">{request.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="approval-change" aria-label="Perubahan yang diminta">
        <div><small>Status saat diajukan</small><strong>{statusLabel(beforeStatus)}</strong></div>
        <span aria-hidden="true">→</span>
        <div><small>Status yang diminta</small><strong>{statusLabel(afterStatus)}</strong></div>
      </div>
      <div className="approval-reason"><small>Alasan pemohon</small><p>{request.reason}</p></div>
      {request.decisions.map((decision) => (
        <div className="approval-decision" key={decision.id}>
          <strong>{decision.approver.displayName} · {decision.decision}</strong>
          <span>{decision.reason || "Tanpa catatan"} · {formatDate(decision.decidedAt)}</span>
        </div>
      ))}
      {reviewer && pending && (
        <div className="approval-review">
          <label htmlFor={`decision-reason-${request.id}`}>Catatan keputusan</label>
          <textarea
            id={`decision-reason-${request.id}`}
            maxLength={2000}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Jelaskan dasar persetujuan atau penolakan"
            value={decisionReason}
          />
          <div className="approval-review-actions">
            <button className="approval-button reject" disabled={busy || decisionReason.trim().length < 3} onClick={() => onDecision("REJECTED")} type="button">
              <X size={14} /> Tolak
            </button>
            <button className="approval-button approve" disabled={busy || decisionReason.trim().length < 3} onClick={() => onDecision("APPROVED")} type="button">
              <Check size={14} /> Setujui dan jalankan
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [inbox, setInbox] = useState<ApprovalRequestSummary[]>([]);
  const [mine, setMine] = useState<ApprovalRequestSummary[]>([]);
  const [sppgs, setSppgs] = useState<ApprovalSppgOption[]>([]);
  const [selectedSppgId, setSelectedSppgId] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const canReview = user ? hasPermission(user, "approval:review") : false;
  const canRequest = user ? hasPermission(user, "sppg:manage") : false;
  const selectedSppg = sppgs.find((sppg) => sppg.id === selectedSppgId) ?? null;

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const current = await getCurrentSession();
        if (!active) return;
        setUser(current);
        const review = hasPermission(current, "approval:review");
        const request = hasPermission(current, "sppg:manage");
        if (!review && !request) {
          setError("Akun Anda tidak memiliki izin untuk melihat atau mengajukan persetujuan.");
          setLoading(false);
          return;
        }
        const [inboxResult, mineResult, sppgResult] = await Promise.all([
          review ? getApprovalInbox() : Promise.resolve(null),
          request ? getMyApprovalRequests() : Promise.resolve(null),
          request ? getApprovalSppgs() : Promise.resolve(null),
        ]);
        if (!active) return;
        setInbox(inboxResult?.data ?? []);
        setMine(mineResult?.data ?? []);
        setSppgs(sppgResult ?? []);
        setSelectedSppgId((currentId) => currentId || sppgResult?.[0]?.id || "");
      } catch (loadError: unknown) {
        if (!active) return;
        if (loadError instanceof Error && loadError.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadKey, router]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSppg || requestReason.trim().length < 3 || !targetStatus) return;
    setBusy("request");
    setError("");
    setNotice("");
    try {
      await requestSppgStatusChange(selectedSppg.id, {
        version: selectedSppg.version,
        targetStatus,
        reason: requestReason.trim(),
      });
      setRequestReason("");
      setNotice("Permintaan terkirim. Status SPPG belum berubah sampai approver menyetujuinya.");
      setReloadKey((value) => value + 1);
    } catch (submitError: unknown) {
      setError(errorMessage(submitError));
    } finally {
      setBusy("");
    }
  }

  async function submitDecision(request: ApprovalRequestSummary, decision: "APPROVED" | "REJECTED") {
    const reason = decisionReasons[request.id]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(request.id);
    setError("");
    setNotice("");
    try {
      const result = await decideApprovalRequest(request.id, { decision, reason });
      setNotice(result.status === "FAILED"
        ? "Permintaan gagal dijalankan karena data SPPG berubah. Pemohon perlu mengajukan ulang."
        : decision === "APPROVED"
          ? "Permintaan disetujui dan perubahan status sudah dijalankan."
          : "Permintaan ditolak; status SPPG tidak berubah.");
      setReloadKey((value) => value + 1);
    } catch (decisionError: unknown) {
      setError(errorMessage(decisionError));
    } finally {
      setBusy("");
    }
  }

  if (loading) return <main className="session-state"><span className="session-spinner" /><p>Memuat permintaan persetujuan…</p></main>;
  if (!user) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>{error || "Sesi tidak dapat diverifikasi."}</p><button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  if (!canReview && !canRequest) return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>{error}</p><Link className="session-retry" href="/">Kembali ke dashboard</Link></main>;

  return (
    <div className="approval-page">
      {/* MARKER: updated approvals page */}
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><strong>Persetujuan</strong></div>
        <div className="topbar-actions"><HeaderAccount user={user} /></div>
      </header>
      <div className="content-area">
        <div className="page-heading">
          <div className="approval-heading-icon"><ClipboardCheck size={19} /></div>
          <div><div className="eyebrow"><span className="eyebrow-line" />MODEL B · PEMISAHAN TUGAS</div><h1>Persetujuan Perubahan Status SPPG</h1><p>Daftar permohonan perubahan status SPPG (suspend/aktifkan) yang menunggu persetujuan. Pendaftaran SPPG baru dikelola di halaman SPPG.</p></div>
          <button className="approval-refresh" onClick={() => setReloadKey((value) => value + 1)} type="button"><RefreshCw size={14} /> Muat ulang</button>
        </div>

        {notice && <div className="approval-notice" role="status"><Check size={15} />{notice}</div>}
        {error && <div className="approval-error" role="alert">{error}</div>}

        {canRequest && (
          <section className="panel approval-request-panel">
            <div className="panel-heading"><div><h2>Ajukan perubahan status SPPG</h2><p>Permintaan akan menunggu review dan tidak mengubah data sebelum disetujui.</p></div><Clock3 size={16} /></div>
            <form className="approval-request-form" onSubmit={submitRequest}>
              <label className="approval-field"><span>SPPG</span><select required onChange={(event) => { setSelectedSppgId(event.target.value); setTargetStatus(""); }} value={selectedSppgId}><option value="">Pilih SPPG</option>{sppgs.map((sppg) => <option key={sppg.id} value={sppg.id}>{sppg.code} · {sppg.name} ({statusLabel(sppg.status)})</option>)}</select></label>
              <label className="approval-field"><span>Status yang diminta</span><select required disabled={!selectedSppg} onChange={(event) => setTargetStatus(event.target.value)} value={targetStatus}><option value="">Pilih status</option>{["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"].filter((status) => status !== selectedSppg?.status).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
              <label className="approval-field approval-reason-field"><span>Alasan wajib</span><textarea maxLength={2000} minLength={3} onChange={(event) => setRequestReason(event.target.value)} placeholder="Jelaskan kebutuhan dan dampak perubahan status" required value={requestReason} /></label>
              {!sppgs.length && <p className="approval-empty-inline">Tidak ada SPPG dalam scope yang dapat dipilih.</p>}
              <button className="btn btn-primary" disabled={busy === "request" || !selectedSppg || !targetStatus || requestReason.trim().length < 3} type="submit">{busy === "request" ? "Mengirim…" : "Kirim untuk persetujuan"}</button>
            </form>
          </section>
        )}

        <section className="kpi-grid" style={{ marginBottom: 16 }}>
          <article className="kpi-card"><div className="kpi-label">Menunggu</div><div className="kpi-value">{inbox.length}</div></article>
          <article className="kpi-card"><div className="kpi-label">Disetujui</div><div className="kpi-value">{mine.filter((r) => r.status === 'APPROVED').length}</div></article>
          <article className="kpi-card"><div className="kpi-label">Ditolak</div><div className="kpi-value">{mine.filter((r) => r.status === 'REJECTED').length}</div></article>
          <article className="kpi-card"><div className="kpi-label">Total</div><div className="kpi-value">{inbox.length + mine.length}</div></article>
        </section>
        {canReview && <section className="approval-section"><div className="approval-section-heading"><div><h2>Inbox approver</h2><p>{inbox.length} permintaan pada halaman ini</p></div><span className="approval-count">{inbox.length}</span></div>{inbox.length ? <div className="approval-list">{inbox.map((request) => <ApprovalCard key={request.id} request={request} reviewer busy={busy === request.id} decisionReason={decisionReasons[request.id] ?? ""} onReasonChange={(value) => setDecisionReasons((current) => ({ ...current, [request.id]: value }))} onDecision={(decision) => void submitDecision(request, decision)} />)}</div> : <div className="approval-empty"><ClipboardCheck size={20} /><strong>Tidak ada permintaan menunggu</strong><span>Permintaan dalam scope akan muncul di sini.</span></div>}</section>}

        {canRequest && <section className="approval-section"><div className="approval-section-heading"><div><h2>Permintaan saya</h2><p>Status dan jejak keputusan permintaan yang Anda ajukan.</p></div></div>{mine.length ? <div className="approval-list">{mine.map((request) => <ApprovalCard key={request.id} request={request} reviewer={false} busy={false} decisionReason="" onReasonChange={() => undefined} onDecision={() => undefined} />)}</div> : <div className="approval-empty"><ClipboardCheck size={20} /><strong>Belum ada permintaan</strong><span>Permintaan yang dikirim akan tampil di sini.</span></div>}</section>}
      </div>
    </div>
  );
}
