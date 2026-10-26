"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  assignException,
  closeException,
  escalateException,
  getCurrentSession,
  getExceptionAssignees,
  getExceptions,
  getSessionRole,
  hasPermission,
  investigateException,
  resolveException,
  triageException,
  type ExceptionAssignee,
  type ExceptionCloseOutcome,
  type ExceptionSummary,
  type Paginated,
  type SessionUser,
} from "@/lib/api";

const PAGE_SIZE = 25;

type ExceptionAction = "triage" | "assign" | "investigate" | "resolve" | "escalate" | "close";

const closedExceptionStatuses = new Set([
  "RESOLVED",
  "FALSE_POSITIVE",
  "DUPLICATE",
  "CLOSED_WITH_NOTE",
]);

const statusOptions = [
  { value: "", label: "Semua status" },
  { value: "DETECTED", label: "Terdeteksi" },
  { value: "TRIAGED", label: "Sudah triage" },
  { value: "ASSIGNED", label: "Ditugaskan" },
  { value: "INVESTIGATING", label: "Investigasi" },
  { value: "ESCALATED", label: "Eskalasi" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "FALSE_POSITIVE", label: "False positive" },
  { value: "DUPLICATE", label: "Duplikat" },
  { value: "CLOSED_WITH_NOTE", label: "Ditutup dengan catatan" },
];

const severityOptions = [
  { value: "", label: "Semua tingkat" },
  { value: "ATTENTION", label: "Perhatian" },
  { value: "HIGH", label: "Tinggi" },
  { value: "CRITICAL", label: "Kritis" },
];

const sourceOptions = [
  { value: "", label: "Semua sumber" },
  { value: "GPS_STALE", label: "GPS tertunda" },
  { value: "OFFLINE", label: "Perangkat offline" },
  { value: "ROUTE_DEVIATION", label: "Deviasi rute" },
  { value: "LATE_ARRIVAL", label: "Keterlambatan" },
  { value: "QR_FAILURE", label: "Kegagalan QR" },
  { value: "QUANTITY_VARIANCE", label: "Selisih porsi" },
  { value: "POD_INCOMPLETE", label: "POD belum lengkap" },
  { value: "OTHER", label: "Lainnya" },
];

const statusLabels: Record<string, string> = {
  DETECTED: "Terdeteksi",
  TRIAGED: "Sudah triage",
  ASSIGNED: "Ditugaskan",
  INVESTIGATING: "Investigasi",
  RESOLVED: "Selesai",
  ESCALATED: "Eskalasi",
  FALSE_POSITIVE: "False positive",
  DUPLICATE: "Duplikat",
  CLOSED_WITH_NOTE: "Ditutup dengan catatan",
};

const severityLabels: Record<string, string> = {
  ATTENTION: "Perhatian",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

const sourceLabels: Record<string, string> = {
  GPS_STALE: "GPS tertunda",
  OFFLINE: "Perangkat offline",
  ROUTE_DEVIATION: "Deviasi rute",
  LATE_ARRIVAL: "Keterlambatan",
  QR_FAILURE: "Kegagalan QR",
  QUANTITY_VARIANCE: "Selisih porsi",
  POD_INCOMPLETE: "POD belum lengkap",
  OTHER: "Lainnya",
};

const actionLabels: Record<ExceptionAction, string> = {
  triage: "Triage",
  assign: "Tugaskan",
  investigate: "Mulai investigasi",
  resolve: "Selesaikan kasus",
  escalate: "Eskalasi",
  close: "Tutup kasus",
};

const outcomeLabels: Record<ExceptionCloseOutcome, string> = {
  FALSE_POSITIVE: "False positive",
  DUPLICATE: "Duplikat",
  CLOSED_WITH_NOTE: "Ditutup dengan catatan",
};

function labelOf(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}

function exceptionActionsFor(status: string): ExceptionAction[] {
  switch (status) {
    case "DETECTED":
      return ["triage", "assign", "escalate", "close"];
    case "TRIAGED":
      return ["assign", "escalate", "close"];
    case "ASSIGNED":
      return ["investigate", "resolve", "escalate", "close"];
    case "INVESTIGATING":
      return ["resolve", "escalate", "close"];
    case "ESCALATED":
      return ["investigate", "resolve", "close"];
    default:
      return [];
  }
}

function defaultExceptionAction(status: string): ExceptionAction {
  if (status === "TRIAGED") return "assign";
  if (status === "ASSIGNED") return "investigate";
  if (status === "INVESTIGATING") return "resolve";
  if (status === "ESCALATED") return "investigate";
  return "triage";
}

function severityTone(severity: string) {
  if (severity === "CRITICAL") return "red";
  if (severity === "HIGH") return "amber";
  return "violet";
}

function statusTone(status: string) {
  if (closedExceptionStatuses.has(status)) return "green";
  if (status === "ESCALATED") return "red";
  if (status === "INVESTIGATING" || status === "ASSIGNED") return "blue";
  return "amber";
}

function actionErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "EXCEPTION_CHANGED_RETRY":
      return "Exception sudah berubah. Muat ulang data lalu coba lagi.";
    case "EXCEPTION_TRANSITION_NOT_ALLOWED":
      return "Status exception tidak mengizinkan tindakan tersebut.";
    case "EXCEPTION_NOT_FOUND":
      return "Exception tidak ditemukan atau berada di luar scope akses.";
    case "ASSIGNEE_NOT_FOUND":
      return "Penerima tugas tidak aktif atau berada di luar scope akses.";
    case "CSRF_INVALID":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk mengelola exception.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    default:
      return "Tindakan exception gagal diproses. Periksa koneksi API lalu coba lagi.";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function ExceptionsPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [data, setData] = useState<Paginated<ExceptionSummary> | null>(null);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [source, setSource] = useState("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");

  const [target, setTarget] = useState<ExceptionSummary | null>(null);
  const [action, setAction] = useState<ExceptionAction>("triage");
  const [severityValue, setSeverityValue] = useState<ExceptionSummary["severity"]>("ATTENTION");
  const [outcome, setOutcome] = useState<ExceptionCloseOutcome>("CLOSED_WITH_NOTE");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [assignees, setAssignees] = useState<ExceptionAssignee[] | null>(null);
  const [assigneeState, setAssigneeState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeReloadKey, setAssigneeReloadKey] = useState(0);

  const canManage = sessionUser ? hasPermission(sessionUser, "exception:manage") : false;

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(false);

      let user: SessionUser;
      try {
        user = await getCurrentSession();
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setSessionState("unavailable");
        setLoading(false);
        return;
      }
      if (!active) return;
      setSessionUser(user);
      setSessionState("ready");
      if (!hasPermission(user, "exception:read")) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      try {
        const result = await getExceptions({
          status: status || undefined,
          severity: severity || undefined,
          source: source || undefined,
          assignedToMe: assignedToMe || undefined,
          search: search || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!active) return;
        setData(result);
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        if (error instanceof Error && error.message === "REQUEST_FAILED_403") {
          setForbidden(true);
          return;
        }
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [assignedToMe, page, reloadKey, router, search, severity, source, status]);

  useEffect(() => {
    if (!target || action !== "assign" || !canManage) return;
    let active = true;

    getExceptionAssignees(assigneeQuery || undefined)
      .then((list) => {
        if (!active) return;
        setAssignees(list);
        setAssigneeState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setAssigneeState("error");
      });

    return () => {
      active = false;
    };
  }, [action, assigneeQuery, assigneeReloadKey, canManage, router, target]);

  useEffect(() => {
    if (!target) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setTarget(null);
        setActionError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, target]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setStatus("");
    setSeverity("");
    setSource("");
    setAssignedToMe(false);
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  function openAction(exception: ExceptionSummary) {
    if (busy || !sessionUser) return;
    const nextAction = defaultExceptionAction(exception.status);
    setTarget(exception);
    setAction(nextAction);
    setSeverityValue(exception.severity);
    setOutcome("CLOSED_WITH_NOTE");
    setReason("");
    setNote("");
    setResolution("");
    setActionError("");
    setNotice("");
    setAssignees(null);
    setAssigneeState(nextAction === "assign" ? "loading" : "idle");
    setAssigneeSearch("");
    setAssigneeQuery("");
    setAssigneeId(sessionUser.id);
  }

  function closeModal() {
    if (busy) return;
    setTarget(null);
    setActionError("");
  }

  async function submitAction() {
    if (!target || busy) return;
    setActionError("");

    if (reason.trim().length < 3) {
      setActionError("Alasan tindakan wajib diisi minimal 3 karakter.");
      return;
    }
    if (note.trim().length > 0 && note.trim().length < 3) {
      setActionError("Catatan tambahan minimal 3 karakter atau kosongkan.");
      return;
    }
    if (action === "resolve" && resolution.trim().length < 3) {
      setActionError("Catatan resolusi wajib diisi minimal 3 karakter.");
      return;
    }
    if (action === "close" && outcome === "CLOSED_WITH_NOTE" && note.trim().length < 3) {
      setActionError("Penutupan dengan catatan wajib menyertakan catatan minimal 3 karakter.");
      return;
    }
    if (action === "assign" && !assigneeId) {
      setActionError("Pilih penerima tugas terlebih dahulu.");
      return;
    }

    setBusy(true);
    const base = {
      version: target.version,
      reason: reason.trim(),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    try {
      if (action === "triage") {
        await triageException(target.id, { ...base, severity: severityValue });
      } else if (action === "assign") {
        await assignException(target.id, { ...base, assigneeUserId: assigneeId });
      } else if (action === "investigate") {
        await investigateException(target.id, base);
      } else if (action === "resolve") {
        await resolveException(target.id, {
          version: target.version,
          reason: reason.trim(),
          resolutionNote: resolution.trim(),
        });
      } else if (action === "escalate") {
        await escalateException(target.id, base);
      } else {
        await closeException(target.id, { ...base, outcome });
      }

      const assigneeName = assignees?.find((assignee) => assignee.id === assigneeId)?.displayName;
      const message = {
        triage: "Exception berhasil ditriage.",
        assign: `Exception ditugaskan kepada ${assigneeName ?? "pengguna terpilih"}.`,
        investigate: "Investigasi exception dimulai.",
        resolve: "Exception berhasil diselesaikan.",
        escalate: "Exception berhasil dieskalasi.",
        close: "Exception berhasil ditutup.",
      }[action];

      setTarget(null);
      setNotice(message);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setActionError(actionErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <main className="session-state">
        <span className="session-spinner" />
        <p>Memuat pusat risiko...</p>
      </main>
    );
  }

  if (sessionState === "unavailable" || !sessionUser) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Layanan belum tersedia</h1>
        <p>Pusat risiko tidak dapat memverifikasi sesi. Pastikan API dan PostgreSQL aktif.</p>
        <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Akses terbatas</h1>
        <p>Peran <strong>{getSessionRole(sessionUser)}</strong> tidak memiliki izin membaca exception. Hubungi administrator untuk penugasan role.</p>
        <button className="session-retry" onClick={() => router.replace("/")}>Kembali ke ringkasan</button>
      </main>
    );
  }

  const exceptions = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const activeOnPage = exceptions.filter((exception) => !closedExceptionStatuses.has(exception.status)).length;
  const criticalOnPage = exceptions.filter((exception) => exception.severity === "CRITICAL" && !closedExceptionStatuses.has(exception.status)).length;
  const actionOptions = target ? exceptionActionsFor(target.status) : [];
  const selectedAssignee = assignees?.find((assignee) => assignee.id === assigneeId) ?? null;
  const submitDisabled =
    busy ||
    reason.trim().length < 3 ||
    (note.trim().length > 0 && note.trim().length < 3) ||
    (action === "resolve" && resolution.trim().length < 3) ||
    (action === "close" && outcome === "CLOSED_WITH_NOTE" && note.trim().length < 3) ||
    (action === "assign" && (assigneeState !== "ready" || !assignees?.some((assignee) => assignee.id === assigneeId)));

  return (
    <main className="trip-page trips-page exceptions-page">
      <header className="trip-topbar">
        <Link className="trip-back" href="/">
          <ArrowLeft size={15} />
          Ringkasan
        </Link>
        <Link className="trip-brand" href="/" aria-label="RADAR MBG beranda">
          <span className="brand-mark"><span /><span /><span /></span>
          <strong>RADAR<span>MBG</span></strong>
        </Link>
        <div className="trip-user">
          <span className="trip-user-avatar">{initials(sessionUser.displayName)}</span>
          <span>
            <strong>{sessionUser.displayName}</strong>
            <small>{getSessionRole(sessionUser)}</small>
          </span>
        </div>
      </header>

      <div className="trip-content">
        <div className="trip-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />OPERASIONAL</div>
            <h1>Pusat risiko</h1>
            <p>Daftar exception terpadu sesuai scope akses, lengkap dengan penugasan dan tindak lanjut.</p>
          </div>
          <div className="trip-heading-actions">
            <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={14} />
              {loading ? "Memuat..." : "Muat ulang"}
            </button>
          </div>
        </div>

        {notice && (
          <div className="exceptions-notice" role="status">
            <CheckCircle2 size={15} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Tutup notifikasi"><X size={14} /></button>
          </div>
        )}

        <section className="panel trips-toolbar exceptions-toolbar">
          <form className="exceptions-filters" onSubmit={applySearch}>
            <div className="trips-filter exceptions-search">
              <label htmlFor="exception-search">Cari</label>
              <input
                id="exception-search"
                className="exception-search-input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={160}
                placeholder="Judul atau detail kasus..."
              />
            </div>
            <div className="trips-filter">
              <label htmlFor="exception-severity">Tingkat</label>
              <select
                id="exception-severity"
                className="trip-filter-select"
                value={severity}
                onChange={(event) => { setSeverity(event.target.value); setPage(1); }}
              >
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="trips-filter">
              <label htmlFor="exception-status">Status</label>
              <select
                id="exception-status"
                className="trip-filter-select"
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="trips-filter">
              <label htmlFor="exception-source">Sumber</label>
              <select
                id="exception-source"
                className="trip-filter-select"
                value={source}
                onChange={(event) => { setSource(event.target.value); setPage(1); }}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <label className="exception-toggle">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(event) => { setAssignedToMe(event.target.checked); setPage(1); }}
              />
              Tugas saya
            </label>
            <button className="trip-create-trigger" type="submit">
              <Search size={14} />
              Cari
            </button>
            <button className="session-retry exceptions-reset" type="button" onClick={resetFilters}>
              <RefreshCw size={13} />
              Reset
            </button>
          </form>
          <div className="trips-toolbar-stats">
            <span><strong>{pagination?.total ?? 0}</strong> total</span>
            <span><strong>{activeOnPage}</strong> aktif di halaman ini</span>
            <span><strong>{criticalOnPage}</strong> kritis di halaman ini</span>
            <span><strong>{pagination ? `${pagination.page}/${Math.max(1, totalPages)}` : "—"}</strong> halaman</span>
          </div>
        </section>

        <section className="panel trips-list-panel">
          <div className="panel-heading">
            <div>
              <div className="section-title-row">
                <h2>Daftar exception</h2>
                <span className="count-chip">{pagination?.total ?? 0}</span>
              </div>
              <p>Prioritas berdasarkan status, tingkat keparahan, dan waktu kejadian.</p>
            </div>
          </div>

          {loadError ? (
            <div className="trips-empty">
              <AlertTriangle size={19} />
              <strong>Daftar exception gagal dimuat</strong>
              <span>API tidak merespons atau sesi tidak lagi valid.</span>
              <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button>
            </div>
          ) : loading && !data ? (
            <div className="trips-empty"><span className="session-spinner" /><span>Memuat exception...</span></div>
          ) : exceptions.length === 0 ? (
            <div className="trips-empty">
              <ShieldCheck size={19} />
              <strong>Tidak ada exception</strong>
              <span>
                {search || status || severity || source || assignedToMe
                  ? "Tidak ada kasus yang cocok dengan filter saat ini."
                  : "Belum ada exception dalam scope akses Anda."}
              </span>
            </div>
          ) : (
            <div className={`table-wrap ${loading ? "trips-table-loading" : ""}`}>
              <table>
                <thead>
                  <tr>
                    <th>Kasus</th>
                    <th>SPPG / Trip</th>
                    <th>Sumber</th>
                    <th>Tingkat</th>
                    <th>Status</th>
                    <th>Penanggung jawab</th>
                    <th>Tenggat</th>
                    <th><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((exception) => {
                    const canAct = canManage && exceptionActionsFor(exception.status).length > 0;
                    return (
                      <tr key={exception.id}>
                        <td>
                          <strong className="exception-title">{exception.title}</strong>
                          <span className="table-sub">
                            EXC-{exception.id.slice(0, 8).toUpperCase()} · {relativeTime(exception.openedAt)}
                          </span>
                        </td>
                        <td>
                          <div className="route-copy">
                            <strong>{exception.sppg.name}</strong>
                            {exception.tripId ? (
                              <Link className="trip-id trip-detail-link" href={`/trips/${exception.tripId}`}>
                                TRP-{exception.tripId.slice(0, 8).toUpperCase()}
                              </Link>
                            ) : (
                              <small>Tanpa trip</small>
                            )}
                          </div>
                        </td>
                        <td><span className="exception-source">{labelOf(sourceLabels, exception.source)}</span></td>
                        <td>
                          <span className={`status-pill status-${severityTone(exception.severity)}`}>
                            <span className="status-dot" />
                            {labelOf(severityLabels, exception.severity)}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${statusTone(exception.status)}`}>
                            <span className="status-dot" />
                            {labelOf(statusLabels, exception.status)}
                          </span>
                        </td>
                        <td>
                          {exception.assignee ? (
                            <div className="driver-cell">
                              <span className="driver-avatar avatar-blue">{initials(exception.assignee.displayName)}</span>
                              <span className="exception-assignee-name">{exception.assignee.displayName}</span>
                            </div>
                          ) : (
                            <span className="exception-unassigned">Belum ditugaskan</span>
                          )}
                        </td>
                        <td>
                          <span className={`exception-due ${exception.dueAt && !closedExceptionStatuses.has(exception.status) && new Date(exception.dueAt) < new Date() ? "exception-due-overdue" : ""}`}>
                            {exception.dueAt ? formatDateTime(exception.dueAt) : "—"}
                          </span>
                        </td>
                        <td>
                          {canAct ? (
                            <button className="trips-detail-action exception-action-trigger" onClick={() => openAction(exception)}>
                              Tindak lanjut
                              {exception.status === "ESCALATED" ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}
                            </button>
                          ) : (
                            <span className="exception-no-action">
                              {closedExceptionStatuses.has(exception.status) ? "Selesai" : "Baca saja"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="trips-pagination">
            <span>
              {pagination && pagination.total > 0
                ? `Menampilkan ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} dari ${pagination.total}`
                : "Tidak ada data"}
            </span>
            <div>
              <button
                className="trips-page-button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={loading || page <= 1}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="trips-page-number">{page} / {Math.max(1, totalPages)}</span>
              <button
                className="trips-page-button"
                onClick={() => setPage((value) => value + 1)}
                disabled={loading || totalPages === 0 || page >= totalPages}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {target && (
        <div
          className="trip-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="trip-modal trip-exception-modal" role="dialog" aria-modal="true" aria-labelledby="exception-action-title">
            <button className="trip-modal-close" onClick={closeModal} disabled={busy} aria-label="Tutup dialog">
              <X size={17} />
            </button>
            <span className="trip-modal-icon primary">
              {action === "triage"
                ? <AlertTriangle size={19} />
                : action === "assign"
                  ? <UserRound size={19} />
                  : action === "investigate"
                    ? <Search size={19} />
                    : action === "resolve"
                      ? <CheckCircle2 size={19} />
                      : action === "close"
                        ? <ShieldCheck size={19} />
                        : <AlertTriangle size={19} />}
            </span>
            <h2 id="exception-action-title">Tindak lanjut exception</h2>
            <p>Tindakan tercatat pada event, audit, dan riwayat kasus.</p>

            <div className="trip-exception-summary">
              <strong>{target.title}</strong>
              <span>
                {labelOf(statusLabels, target.status)} · {target.sppg.name} · {labelOf(sourceLabels, target.source)}
              </span>
            </div>

            <label className="trip-form-field" htmlFor="exception-action">
              <span>Tindakan</span>
              <select
                id="exception-action"
                value={action}
                onChange={(event) => {
                  const nextAction = event.target.value as ExceptionAction;
                  if (nextAction === "assign" && assigneeState !== "loading" && assigneeState !== "ready") {
                    setAssigneeState("loading");
                  }
                  setAction(nextAction);
                  setActionError("");
                }}
                disabled={busy}
              >
                {actionOptions.map((option) => (
                  <option key={option} value={option}>{actionLabels[option]}</option>
                ))}
              </select>
            </label>

            {action === "triage" && (
              <label className="trip-form-field" htmlFor="exception-severity-value">
                <span>Tingkat keparahan</span>
                <select
                  id="exception-severity-value"
                  value={severityValue}
                  onChange={(event) => setSeverityValue(event.target.value as ExceptionSummary["severity"])}
                  disabled={busy}
                >
                  <option value="ATTENTION">Perhatian</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="CRITICAL">Kritis</option>
                </select>
              </label>
            )}

            {action === "assign" && (
              <div className="exception-assignee-picker">
                <span className="exception-picker-label">Penerima tugas</span>
                <div className="exception-picker-search">
                  <input
                    value={assigneeSearch}
                    onChange={(event) => setAssigneeSearch(event.target.value)}
                    maxLength={80}
                    placeholder="Cari nama atau username..."
                    disabled={busy || assigneeState === "loading"}
                  />
                  <button
                    type="button"
                    className="exception-picker-button"
                    onClick={() => {
                      setAssigneeState("loading");
                      setActionError("");
                      setAssigneeQuery(assigneeSearch.trim());
                      setAssigneeReloadKey((value) => value + 1);
                    }}
                    disabled={busy || assigneeState === "loading"}
                  >
                    <Search size={13} />
                    Cari
                  </button>
                </div>

                {assigneeState === "loading" ? (
                  <div className="exception-picker-state"><span className="session-spinner" /> Memuat pengguna...</div>
                ) : assigneeState === "error" ? (
                  <div className="exception-picker-state exception-picker-error">
                    <AlertTriangle size={14} />
                    <span>Pengguna gagal dimuat.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeState("loading");
                        setAssigneeReloadKey((value) => value + 1);
                      }}
                    >
                      Coba lagi
                    </button>
                  </div>
                ) : assignees && assignees.length > 0 ? (
                  <select
                    className="trip-filter-select exception-assignee-select"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    disabled={busy}
                    aria-label="Penerima tugas"
                  >
                    <option value="">Pilih pengguna</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.displayName}
                        {assignee.roles.length ? ` · ${assignee.roles.map((role) => role.name).join(", ")}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="exception-picker-state">
                    <UsersEmpty />
                  </div>
                )}

                {selectedAssignee && (
                  <div className="trip-exception-assignee">
                    <UserRound size={15} />
                    <div>
                      <span>Terpilih</span>
                      <strong>{selectedAssignee.displayName}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {action === "resolve" && (
              <label className="trip-modal-field">
                <span>Catatan resolusi</span>
                <textarea
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  maxLength={4000}
                  rows={3}
                  placeholder="Jelaskan tindakan yang menyelesaikan masalah"
                  disabled={busy}
                />
                <small>{resolution.trim().length}/4000 · minimal 3 karakter</small>
              </label>
            )}

            {action === "close" && (
              <label className="trip-form-field" htmlFor="exception-outcome">
                <span>Outcome penutupan</span>
                <select
                  id="exception-outcome"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value as ExceptionCloseOutcome)}
                  disabled={busy}
                >
                  {(Object.keys(outcomeLabels) as ExceptionCloseOutcome[]).map((option) => (
                    <option key={option} value={option}>{outcomeLabels[option]}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="trip-modal-field">
              <span>Alasan tindakan</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Contoh: sinyal GPS terlambat lebih dari 30 menit"
                disabled={busy}
              />
              <small>{reason.trim().length}/2000 · minimal 3 karakter</small>
            </label>

            {action !== "resolve" && (
              <label className="trip-modal-field">
                <span>
                  Catatan tambahan
                  {action === "close" && outcome === "CLOSED_WITH_NOTE" ? " (wajib)" : " (opsional)"}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={4000}
                  rows={2}
                  placeholder="Konteks tambahan untuk penelusuran"
                  disabled={busy}
                />
                <small>{note.trim().length}/4000</small>
              </label>
            )}

            {actionError && (
              <div className="trip-modal-error" role="alert">
                <AlertTriangle size={14} />
                <span>{actionError}</span>
              </div>
            )}

            <div className="trip-modal-actions">
              <button className="trip-action-button muted" onClick={closeModal} disabled={busy}>Kembali</button>
              <button
                className="trip-action-button primary"
                onClick={() => void submitAction()}
                disabled={submitDisabled}
              >
                {busy ? "Memproses..." : actionLabels[action]}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function UsersEmpty() {
  return <span>Tidak ada pengguna dengan izin mengelola exception dalam scope.</span>;
}
