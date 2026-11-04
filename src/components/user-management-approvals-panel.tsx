"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  History,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
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
  type Paginated,
  type SessionUser,
} from "@/lib/api";

type Pagination = Paginated<ApprovalRequestSummary>["pagination"];

type ApprovalTone = "pending" | "approved" | "rejected" | "failed" | "info";

const SPPG_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu aktivasi",
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
  ARCHIVED: "Diarsipkan",
};

const APPROVAL_STATUS_META: Record<string, { label: string; tone: ApprovalTone }> = {
  PENDING_APPROVAL: { label: "Menunggu persetujuan", tone: "pending" },
  APPROVED: { label: "Disetujui", tone: "approved" },
  EXECUTED: { label: "Dijalankan", tone: "approved" },
  REJECTED: { label: "Ditolak", tone: "rejected" },
  FAILED: { label: "Gagal dijalankan", tone: "failed" },
  SUBMITTED: { label: "Terkirim", tone: "info" },
};

const MINE_STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "PENDING_APPROVAL", label: "Menunggu persetujuan" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "EXECUTED", label: "Dijalankan" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "FAILED", label: "Gagal dijalankan" },
];

function sppgStatusLabel(status?: string | null) {
  if (!status) return "—";
  return SPPG_STATUS_LABELS[status] ?? status;
}

function approvalMeta(status: string) {
  return APPROVAL_STATUS_META[status] ?? { label: status, tone: "info" as ApprovalTone };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function ageLabel(value: string | null) {
  if (!value) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "REQUEST_FAILED_403" || code === "FORBIDDEN") return "Akun Anda tidak memiliki izin untuk tindakan ini.";
  if (code === "REQUEST_FAILED_409") return "Data SPPG berubah atau sudah memiliki permintaan aktif. Muat ulang lalu coba lagi.";
  if (code === "APPROVAL_SELF_REVIEW_FORBIDDEN") return "Anda tidak dapat menyetujui permintaan yang Anda ajukan sendiri.";
  if (code === "SPPG_STATUS_CHANGE_REQUIRES_APPROVAL") return "Perubahan status SPPG harus diajukan melalui persetujuan.";
  if (code === "UNAUTHENTICATED") return "Sesi berakhir. Silakan masuk kembali.";
  return "Permintaan gagal diproses. Periksa koneksi lalu coba lagi.";
}

function ApprovalBadge({ status }: { status: string }) {
  const meta = approvalMeta(status);
  const Icon =
    meta.tone === "pending"
      ? Clock3
      : meta.tone === "approved"
        ? CheckCircle2
        : meta.tone === "rejected"
          ? XCircle
          : meta.tone === "failed"
            ? AlertTriangle
            : ClipboardCheck;
  return (
    <span className={`apv-badge apv-badge-${meta.tone}`}>
      <Icon size={12} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function matchesQuery(request: ApprovalRequestSummary, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return [
    request.target?.code ?? "",
    request.target?.name ?? "",
    request.requestedByUser.displayName,
    request.requestedByUser.username,
    request.id.slice(0, 8).toUpperCase(),
    approvalMeta(request.status).label,
    sppgStatusLabel(request.payloadBefore?.status),
    sppgStatusLabel(request.payloadAfter.status),
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

function PaginationBar({
  pagination,
  page,
  disabled,
  onChange,
}: {
  pagination: Pagination | null;
  page: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, pagination?.totalPages ?? 0);
  return (
    <div className="apv-pagination">
      <span>
        {pagination && pagination.total > 0
          ? `Menampilkan ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} dari ${pagination.total}`
          : "Tidak ada data"}
      </span>
      <div>
        <button
          className="btn btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={disabled || page <= 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={15} />
          Sebelumnya
        </button>
        <span className="trips-page-number">{page} / {totalPages}</span>
        <button
          className="btn btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={disabled || totalPages === 0 || page >= totalPages}
          aria-label="Halaman berikutnya"
        >
          Berikutnya
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function ReviewDrawer({
  request,
  isVisible,
  canReview,
  isOwnRequest,
  busy,
  reason,
  onReasonChange,
  onClose,
  onDecide,
}: {
  request: ApprovalRequestSummary;
  isVisible: boolean;
  canReview: boolean;
  isOwnRequest: boolean;
  busy: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onDecide: (decision: "APPROVED" | "REJECTED") => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const [confirming, setConfirming] = useState<"APPROVED" | "REJECTED" | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isVisible]);

  const pending = request.status === "PENDING_APPROVAL";
  const reviewable = canReview && pending && !isOwnRequest;
  const reasonTooShort = reason.trim().length < 3;
  const requestedStatus = sppgStatusLabel(request.payloadAfter.status);

  return (
    <div
      className="apv-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside ref={drawerRef} className="apv-drawer" role="dialog" aria-modal="true" aria-labelledby="apv-drawer-title">
        <header className="apv-drawer-header">
          <div>
            <ApprovalBadge status={request.status} />
            <h2 id="apv-drawer-title">
              {request.target ? `${request.target.code} — ${request.target.name}` : "SPPG tidak ditemukan"}
            </h2>
            <p>Permintaan perubahan status SPPG · ID {request.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <button ref={closeRef} className="apv-drawer-close" onClick={onClose} aria-label="Tutup detail">
            <X size={16} />
          </button>
        </header>

        <div className="apv-drawer-body">
          <section>
            <h3 className="apv-section-title"><ClipboardCheck size={13} />Ringkasan permintaan</h3>
            <div className="apv-meta-grid">
              <div><small>Pemohon</small><strong>{request.requestedByUser.displayName}</strong></div>
              <div><small>Diajukan</small><strong>{formatDate(request.submittedAt)}</strong></div>
              <div><small>Umur permintaan</small><strong>{ageLabel(request.submittedAt)}</strong></div>
              <div><small>Versi objek</small><strong>{request.objectVersion ?? request.payloadBefore?.version ?? "—"}</strong></div>
            </div>
          </section>

          <section>
            <h3 className="apv-section-title"><ShieldCheck size={13} />Perubahan yang diminta</h3>
            <div className="apv-change">
              <div>
                <small>Status saat diajukan</small>
                <strong>{sppgStatusLabel(request.payloadBefore?.status)}</strong>
              </div>
              <ArrowRight size={16} aria-hidden="true" />
              <div>
                <small>Status yang diminta</small>
                <strong>{requestedStatus}</strong>
              </div>
            </div>
          </section>

          <section>
            <h3 className="apv-section-title"><ClipboardCheck size={13} />Alasan pemohon</h3>
            <p className="apv-note">{request.reason}</p>
          </section>

          {request.decisions.length > 0 && (
            <section>
              <h3 className="apv-section-title"><History size={13} />Riwayat keputusan</h3>
              <div className="apv-history">
                {request.decisions.map((decision) => (
                  <div className="apv-history-item" key={decision.id}>
                    <strong>{decision.approver.displayName} · {approvalMeta(decision.decision).label}</strong>
                    <span>{decision.reason || "Tanpa catatan"} · {formatDate(decision.decidedAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reviewable && (
            <section>
              <h3 className="apv-section-title"><History size={13} />Catatan keputusan</h3>
              <label className="apv-field">
                <span>Wajib diisi, minimal 3 karakter</span>
                <textarea
                  maxLength={2000}
                  onChange={(event) => {
                    onReasonChange(event.target.value);
                    setConfirming(null);
                  }}
                  placeholder="Jelaskan dasar persetujuan atau penolakan"
                  value={reason}
                />
                <span className="apv-counter">{reason.trim().length}/2000</span>
              </label>
            </section>
          )}
        </div>

        <footer className="apv-drawer-footer">
          {reviewable ? (
            confirming ? (
              <div className="apv-confirm">
                  <strong>{confirming === "APPROVED" ? "Konfirmasi persetujuan" : "Konfirmasi penolakan"}</strong>
                  <p style={{ margin: "4px 0 0" }}>
                  {confirming === "APPROVED" ? <>Status SPPG akan langsung berubah menjadi <strong>{requestedStatus}</strong> dan tidak dapat dibatalkan.</> : <>Permintaan ini akan ditolak dan status SPPG tidak berubah.</>}
                  Lanjutkan?
                </p>
                <div className="apv-confirm-actions">
                  <button className="btn btn-sm" onClick={() => setConfirming(null)} disabled={busy}>
                    Batal
                  </button>
                  <button className={`btn btn-sm${confirming === "APPROVED" ? " btn-primary" : " btn-danger"}`} onClick={() => onDecide(confirming)} disabled={busy}>
                    {confirming === "APPROVED" ? <Check size={14} /> : <X size={14} />}
                    {busy ? "Memproses…" : confirming === "APPROVED" ? "Ya, setujui" : "Ya, tolak"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="apv-footer-actions">
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirming("REJECTED")}
                  disabled={busy || reasonTooShort}
                >
                  <X size={14} />
                  Tolak
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setConfirming("APPROVED")}
                  disabled={busy || reasonTooShort}
                >
                  <Check size={14} />
                  Setujui dan jalankan
                </button>
              </div>
            )
          ) : (
            <div className="apv-footer-actions">
              {pending && isOwnRequest && (
                <p className="apv-helper" style={{ flex: 1, textAlign: "left" }}>
                  Anda pengaju permintaan ini. Keputusan harus dilakukan approver lain.
                </p>
              )}
              <button className="btn" onClick={onClose}>Tutup</button>
            </div>
          )}
          {reviewable && !confirming && reasonTooShort && (
            <p className="apv-helper" style={{ marginTop: 8, textAlign: "right" }}>
              Isi catatan keputusan minimal 3 karakter untuk mengaktifkan tombol.
            </p>
          )}
        </footer>
      </aside>
    </div>
  );
}

export function ApprovalsManagementPanel({ isVisible = true }: { isVisible?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [inbox, setInbox] = useState<ApprovalRequestSummary[]>([]);
  const [inboxPagination, setInboxPagination] = useState<Pagination | null>(null);
  const [inboxPage, setInboxPage] = useState(1);
  const [mine, setMine] = useState<ApprovalRequestSummary[]>([]);
  const [minePagination, setMinePagination] = useState<Pagination | null>(null);
  const [minePage, setMinePage] = useState(1);
  const [sppgs, setSppgs] = useState<ApprovalSppgOption[]>([]);
  const [selectedSppgId, setSelectedSppgId] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [inboxQuery, setInboxQuery] = useState("");
  const [mineQuery, setMineQuery] = useState("");
  const [mineStatus, setMineStatus] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
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
          return;
        }
        const [inboxResult, mineResult, sppgResult] = await Promise.all([
          review ? getApprovalInbox({ page: inboxPage }) : Promise.resolve(null),
          request ? getMyApprovalRequests({ page: minePage }) : Promise.resolve(null),
          request ? getApprovalSppgs() : Promise.resolve(null),
        ]);
        if (!active) return;
        setInbox(inboxResult?.data ?? []);
        setInboxPagination(inboxResult?.pagination ?? null);
        setMine(mineResult?.data ?? []);
        setMinePagination(mineResult?.pagination ?? null);
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
  }, [inboxPage, minePage, reloadKey, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleInbox = useMemo(() => inbox.filter((request) => matchesQuery(request, inboxQuery)), [inbox, inboxQuery]);
  const visibleMine = useMemo(
    () =>
      mine
        .filter((request) => matchesQuery(request, mineQuery))
        .filter((request) => !mineStatus || request.status === mineStatus),
    [mine, mineQuery, mineStatus],
  );

  const approvedCount = mine.filter((request) => request.status === "APPROVED" || request.status === "EXECUTED").length;
  const rejectedCount = mine.filter((request) => request.status === "REJECTED").length;
  const activeRequest = reviewId ? [...inbox, ...mine].find((request) => request.id === reviewId) ?? null : null;

  function openReview(request: ApprovalRequestSummary) {
    setDecisionReason("");
    setReviewId(request.id);
  }

  function closeReview() {
    setReviewId(null);
    setDecisionReason("");
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSppg || requestReason.trim().length < 3 || !targetStatus) return;
    setBusy("request");
    setError("");
    setToast(null);
    try {
      await requestSppgStatusChange(selectedSppg.id, {
        version: selectedSppg.version,
        targetStatus,
        reason: requestReason.trim(),
      });
      setRequestReason("");
      setTargetStatus("");
      setFormOpen(false);
      setInboxPage(1);
      setMinePage(1);
      setToast("Permintaan terkirim. Status SPPG belum berubah sampai approver menyetujuinya.");
      setReloadKey((value) => value + 1);
    } catch (submitError: unknown) {
      setError(errorMessage(submitError));
    } finally {
      setBusy("");
    }
  }

  async function submitDecision(request: ApprovalRequestSummary, decision: "APPROVED" | "REJECTED") {
    const reason = decisionReason.trim();
    if (reason.length < 3) return;
    setBusy(request.id);
    setError("");
    setToast(null);
    try {
      const result = await decideApprovalRequest(request.id, { decision, reason });
      setToast(
        result.status === "FAILED"
          ? "Permintaan gagal dijalankan karena data SPPG berubah. Pemohon perlu mengajukan ulang."
          : decision === "APPROVED"
            ? "Permintaan disetujui dan perubahan status sudah dijalankan."
            : "Permintaan ditolak; status SPPG tidak berubah.",
      );
      closeReview();
      setInboxPage(1);
      setReloadKey((value) => value + 1);
    } catch (decisionError: unknown) {
      setError(errorMessage(decisionError));
    } finally {
      setBusy("");
    }
  }

  if (loading && !user) {
    return (
      <main className="session-state">
        <span className="session-spinner" />
        <p>Memuat permintaan persetujuan…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Layanan belum tersedia</h1>
        <p>{error || "Sesi tidak dapat diverifikasi."}</p>
        <button className="session-retry" onClick={() => window.location.reload()}>Coba lagi</button>
      </main>
    );
  }

  if (!canReview && !canRequest) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Akses terbatas</h1>
        <p>{error || "Peran Anda tidak memiliki izin pada modul persetujuan."}</p>
        <Link className="session-retry" href="/">Kembali ke dashboard</Link>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><strong>Persetujuan</strong></div>
        <div className="topbar-actions"><HeaderAccount user={user} /></div>
      </header>

      <div className="content-area">
        {toast && (
          <div className="toast toast-success" role="status">
            <CheckCircle2 size={16} />
            <span>{toast}</span>
            <button onClick={() => setToast(null)} aria-label="Tutup notifikasi"><X size={14} /></button>
          </div>
        )}
        {error && (
          <div className="apv-alert" role="alert">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />MODEL B · PEMISAHAN TUGAS</div>
            <h1>Persetujuan perubahan status SPPG</h1>
            <p>Tinjau permintaan suspend/aktivasi SPPG. Pendaftaran SPPG baru dikelola di halaman SPPG.</p>
          </div>
          <div className="page-actions">
            {canRequest && (
              <button className="btn" onClick={() => setFormOpen((value) => !value)}>
                {formOpen ? <X size={15} /> : <Send size={15} />}
                {formOpen ? "Tutup form" : "Ajukan perubahan"}
              </button>
            )}
            <button className="btn" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={14} />
              {loading ? "Memuat…" : "Muat ulang"}
            </button>
          </div>
        </div>

        <div className="kpi-grid kpi-grid-4">
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-amber"><Clock3 size={16} /></span>
            </div>
            <div className="kpi-label">Menunggu review</div>
            <div className="kpi-value">{inboxPagination?.total ?? 0}</div>
            <div className="kpi-foot"><span className="kpi-dot blue-dot" />Seluruh permintaan</div>
          </article>
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-green"><CheckCircle2 size={16} /></span>
            </div>
            <div className="kpi-label">Disetujui</div>
            <div className="kpi-value">{approvedCount}</div>
            <div className="kpi-foot">
              <span className="kpi-dot blue-dot" />
              {(minePagination?.totalPages ?? 1) > 1 ? "Di halaman ini" : "Permintaan saya"}
            </div>
          </article>
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-red"><XCircle size={16} /></span>
            </div>
            <div className="kpi-label">Ditolak</div>
            <div className="kpi-value">{rejectedCount}</div>
            <div className="kpi-foot">
              <span className="kpi-dot blue-dot" />
              {(minePagination?.totalPages ?? 1) > 1 ? "Di halaman ini" : "Permintaan saya"}
            </div>
          </article>
          <article className="kpi-card kpi-card-enhanced">
            <div className="kpi-top">
              <span className="kpi-icon icon-navy"><ClipboardCheck size={16} /></span>
            </div>
            <div className="kpi-label">Total permintaan saya</div>
            <div className="kpi-value">{minePagination?.total ?? 0}</div>
            <div className="kpi-foot"><span className="kpi-dot blue-dot" />Semua status</div>
          </article>
        </div>

        {canRequest && formOpen && (
          <section className="panel apv-form-panel">
            <div className="panel-header">
              <div>
                <div className="section-title-row">
                  <h2>Ajukan perubahan status SPPG</h2>
                </div>
                <p>Permintaan menunggu review dan tidak mengubah data sebelum disetujui.</p>
              </div>
              <div className="panel-actions">
                <button className="btn btn-sm" onClick={() => setFormOpen(false)}>Tutup</button>
              </div>
            </div>
            <form className="apv-form" onSubmit={submitRequest}>
              <label className="apv-field">
                <span>SPPG</span>
                <select
                  required
                  value={selectedSppgId}
                  onChange={(event) => {
                    setSelectedSppgId(event.target.value);
                    setTargetStatus("");
                  }}
                >
                  <option value="">Pilih SPPG</option>
                  {sppgs.map((sppg) => (
                    <option key={sppg.id} value={sppg.id}>
                      {sppg.code} · {sppg.name} ({sppgStatusLabel(sppg.status)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="apv-field">
                <span>Status yang diminta</span>
                <select
                  required
                  disabled={!selectedSppg}
                  value={targetStatus}
                  onChange={(event) => setTargetStatus(event.target.value)}
                >
                  <option value="">Pilih status</option>
                  {["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]
                    .filter((status) => status !== selectedSppg?.status)
                    .map((status) => (
                      <option key={status} value={status}>{sppgStatusLabel(status)}</option>
                    ))}
                </select>
              </label>
              <label className="apv-field apv-field-wide">
                <span>Alasan permintaan</span>
                <textarea
                  maxLength={2000}
                  minLength={3}
                  required
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.target.value)}
                  placeholder="Jelaskan kebutuhan dan dampak perubahan status"
                />
              </label>
              {!sppgs.length && (
                <p className="apv-helper apv-field-wide">Tidak ada SPPG dalam scope yang dapat dipilih.</p>
              )}
              <div className="apv-form-actions">
                <span className="apv-helper">
                  {requestReason.trim().length < 3 ? "Alasan minimal 3 karakter." : "Permintaan akan masuk ke inbox approver."}
                </span>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy === "request" || !selectedSppg || !targetStatus || requestReason.trim().length < 3}
                >
                  <Send size={14} />
                  {busy === "request" ? "Mengirim…" : "Kirim untuk persetujuan"}
                </button>
              </div>
            </form>
          </section>
        )}

        {canReview && (
          <section className="panel apv-panel">
            <div className="panel-header">
              <div>
                <div className="section-title-row">
                  <h2>Inbox approver</h2>
                  <span className="count-chip">{visibleInbox.length}</span>
                </div>
                <p>Permintaan yang menunggu keputusan Anda.</p>
              </div>
              <div className="panel-actions">
                <div className="search-group apv-search">
                  <Search size={14} />
                  <input
                    type="search"
                    maxLength={100}
                    value={inboxQuery}
                    onChange={(event) => setInboxQuery(event.target.value)}
                    placeholder="Cari SPPG atau pemohon"
                    aria-label="Cari permintaan pada inbox"
                  />
                </div>
              </div>
            </div>

            {loading && inbox.length === 0 ? (
              <div className="empty-state"><span className="session-spinner" /><span>Memuat permintaan…</span></div>
            ) : visibleInbox.length === 0 ? (
              <div className="empty-state">
                <ClipboardCheck size={20} />
                <strong>{inboxQuery ? "Tidak ada hasil pencarian" : "Tidak ada permintaan menunggu"}</strong>
                <span>{inboxQuery ? "Coba kata kunci lain atau hapus pencarian." : "Permintaan dalam scope akan muncul di sini."}</span>
                {inboxQuery && <button className="btn btn-sm" onClick={() => setInboxQuery("")}>Hapus pencarian</button>}
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SPPG</th>
                      <th>Perubahan</th>
                      <th className="apv-hide-md">Pemohon</th>
                      <th>Diajukan</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInbox.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <div className="apv-sppg">
                            <strong>{request.target?.code ?? "—"}</strong>
                            <span>{request.target?.name ?? "SPPG tidak ditemukan"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="apv-change-inline">
                            <span>{sppgStatusLabel(request.payloadBefore?.status)}</span>
                            <ArrowRight size={12} aria-hidden="true" />
                            <strong>{sppgStatusLabel(request.payloadAfter.status)}</strong>
                          </span>
                        </td>
                        <td className="apv-hide-md">
                          <div className="apv-person">
                            <span className="apv-avatar">{initials(request.requestedByUser.displayName)}</span>
                            <span>{request.requestedByUser.displayName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="apv-date">{formatDate(request.submittedAt)}</span>
                          <span className="table-sub">{ageLabel(request.submittedAt)} lalu</span>
                        </td>
                        <td><ApprovalBadge status={request.status} /></td>
                        <td>
                          <button className="btn btn-sm btn-primary" onClick={() => openReview(request)}>
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationBar
              pagination={inboxPagination}
              page={inboxPage}
              disabled={loading}
              onChange={setInboxPage}
            />
          </section>
        )}

        {canRequest && (
          <section className="panel apv-panel">
            <div className="panel-header">
              <div>
                <div className="section-title-row">
                  <h2>Permintaan saya</h2>
                  <span className="count-chip">{visibleMine.length}</span>
                </div>
                <p>Status dan jejak keputusan permintaan yang Anda ajukan.</p>
              </div>
              <div className="panel-actions">
                <select
                  className="trip-filter-select"
                  value={mineStatus}
                  onChange={(event) => setMineStatus(event.target.value)}
                  aria-label="Filter status permintaan"
                >
                  {MINE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div className="search-group apv-search">
                  <Search size={14} />
                  <input
                    type="search"
                    maxLength={100}
                    value={mineQuery}
                    onChange={(event) => setMineQuery(event.target.value)}
                    placeholder="Cari SPPG"
                    aria-label="Cari permintaan saya"
                  />
                </div>
              </div>
            </div>

            {loading && mine.length === 0 ? (
              <div className="empty-state"><span className="session-spinner" /><span>Memuat permintaan…</span></div>
            ) : visibleMine.length === 0 ? (
              <div className="empty-state">
                <ClipboardCheck size={20} />
                <strong>{mine.length === 0 ? "Belum ada permintaan" : "Tidak ada hasil filter"}</strong>
                <span>
                  {mine.length === 0
                    ? "Permintaan yang Anda kirim akan tampil di sini."
                    : "Ubah filter status atau kata kunci pencarian."}
                </span>
                {(mineQuery || mineStatus) && (
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setMineQuery("");
                      setMineStatus("");
                    }}
                  >
                    Reset filter
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SPPG</th>
                      <th>Perubahan</th>
                      <th className="apv-hide-md">Diajukan</th>
                      <th>Status</th>
                      <th className="apv-hide-md">Keputusan</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMine.map((request) => {
                      const decision = request.decisions[request.decisions.length - 1];
                      return (
                        <tr key={request.id}>
                          <td>
                            <div className="apv-sppg">
                              <strong>{request.target?.code ?? "—"}</strong>
                              <span>{request.target?.name ?? "SPPG tidak ditemukan"}</span>
                            </div>
                          </td>
                          <td>
                            <span className="apv-change-inline">
                              <span>{sppgStatusLabel(request.payloadBefore?.status)}</span>
                              <ArrowRight size={12} aria-hidden="true" />
                              <strong>{sppgStatusLabel(request.payloadAfter.status)}</strong>
                            </span>
                          </td>
                          <td className="apv-hide-md">
                            <span className="apv-date">{formatDate(request.submittedAt)}</span>
                            <span className="table-sub">{ageLabel(request.submittedAt)} lalu</span>
                          </td>
                          <td><ApprovalBadge status={request.status} /></td>
                          <td className="apv-hide-md">
                            {decision ? (
                              <>
                                <span className="apv-date">{decision.approver.displayName}</span>
                                <span className="table-sub">{decision.reason || "Tanpa catatan"}</span>
                              </>
                            ) : (
                              <span className="apv-date">—</span>
                            )}
                          </td>
                          <td>
                            <button className="btn btn-sm" onClick={() => openReview(request)}>Detail</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationBar
              pagination={minePagination}
              page={minePage}
              disabled={loading}
              onChange={setMinePage}
            />
          </section>
        )}
      </div>

      {activeRequest && (
        <ReviewDrawer
          request={activeRequest}
          isVisible={isVisible}
          canReview={canReview}
          isOwnRequest={activeRequest.requestedBy === user.id}
          busy={busy === activeRequest.id}
          reason={decisionReason}
          onReasonChange={setDecisionReason}
          onClose={closeReview}
          onDecide={(decision) => void submitDecision(activeRequest, decision)}
        />
      )}
    </main>
  );
}
