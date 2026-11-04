"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HeaderAccount } from "@/components/account-menu";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { FleetMap } from "@/components/fleet-map";
import {
  assignException,
  cancelTrip,
  changeTripDestination,
  closeException,
  completeTrip,
  escalateException,
  getCurrentSession,
  getSessionRole,
  getTripDetail,
  getTripExceptions,
  getTripProofs,
  getTripResourceOptions,
  hasPermission,
  investigateException,
  readyTrip,
  reassignTrip,
  rescheduleTrip,
  resolveException,
  reviewTripDelivery,
  scheduleTrip,
  startTripDelivery,
  submitTripDelivery,
  triageException,
  type ExceptionCloseOutcome,
  type ExceptionSummary,
  type ProofSummary,
  type SessionUser,
  type TripDetail,
  type TripEventSummary,
  type TripResourceOptions,
} from "@/lib/api";

type LoadState = "checking" | "ready" | "notfound" | "data-error" | "unavailable";
type PendingAction = "schedule" | "ready" | "cancel" | "reschedule" | "reassign" | "destination";
type DeliveryAction = "start" | "pod" | "review-accept" | "review-reject" | "complete";
type ExceptionAction = "triage" | "assign" | "investigate" | "resolve" | "escalate" | "close";
type OptionsState = "idle" | "loading" | "ready" | "error";
type TripBundle = {
  detail: TripDetail;
  proofData: ProofSummary[] | null;
  exceptionData: ExceptionSummary[] | null;
};

const cancellableStatuses = new Set(["DRAFT", "SCHEDULED", "READY_TO_DEPART"]);
const editableStatuses = new Set(["DRAFT", "SCHEDULED"]);
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const closedExceptionStatuses = new Set([
  "RESOLVED",
  "FALSE_POSITIVE",
  "DUPLICATE",
  "CLOSED_WITH_NOTE",
]);

const trackingLabels: Record<string, string> = {
  LIVE: "Sinyal aktif",
  STALE: "Data tertunda",
  OFFLINE: "Tidak ada sinyal",
  GPS_UNAVAILABLE: "GPS tidak tersedia",
  ENDED: "Tracking berakhir",
};

const verificationLabels: Record<string, string> = {
  NOT_STARTED: "Belum diverifikasi",
  PENDING: "Menunggu verifikasi",
  VERIFIED: "Terverifikasi",
  FAILED: "Verifikasi gagal",
  MANUAL_REVIEW: "Perlu review manual",
  OVERRIDDEN: "Override manual",
};

const reviewLabels: Record<string, string> = {
  PENDING_REVIEW: "Menunggu review",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
};

const exceptionStatusLabels: Record<string, string> = {
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

const exceptionActionLabels: Record<ExceptionAction, string> = {
  triage: "Triage",
  assign: "Tugaskan ke saya",
  investigate: "Mulai investigasi",
  resolve: "Selesaikan kasus",
  escalate: "Eskalasi",
  close: "Tutup kasus",
};

const exceptionOutcomeLabels: Record<ExceptionCloseOutcome, string> = {
  FALSE_POSITIVE: "False positive",
  DUPLICATE: "Duplikat",
  CLOSED_WITH_NOTE: "Ditutup dengan catatan",
};

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

const tripStatusLabels: Record<string, string> = {
  DRAFT: "Draf",
  SCHEDULED: "Terjadwal",
  READY_TO_DEPART: "Siap berangkat",
  IN_TRANSIT: "Dalam perjalanan",
  ARRIVAL_DETECTED: "Kedatangan terdeteksi",
  ARRIVAL_VERIFIED: "Kedatangan terverifikasi",
  DELIVERY_IN_PROGRESS: "Penyaluran berlangsung",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  EXCEPTION: "Perlu perhatian",
};

const eventLabels: Record<string, string> = {
  "TRIP.CREATED": "Trip dibuat",
  "TRIP.SCHEDULED": "Trip dijadwalkan",
  "TRIP.READY_TO_DEPART": "Siap berangkat",
  "TRIP.STARTED": "Perjalanan dimulai",
  "TRIP.ARRIVAL_DETECTED": "Kedatangan terdeteksi",
  "TRIP.ARRIVAL_VERIFIED": "Kedatangan terverifikasi",
  "TRIP.ARRIVAL_OVERRIDDEN": "Kedatangan diverifikasi manual",
  "TRIP.DELIVERY_STARTED": "Serah terima dimulai",
  "TRIP.DELIVERY_SUBMITTED": "POD disubmit",
  "TRIP.DELIVERY_REVIEWED": "POD direview",
  "TRIP.COMPLETED": "Trip selesai",
  "POD.PROOF_ADDED": "Bukti POD ditambahkan",
  "TRIP.RESCHEDULED": "Jadwal diubah",
  "TRIP.REASSIGNED": "Penugasan diubah",
  "TRIP.CANCELLED": "Trip dibatalkan",
  "TRIP.DESTINATION_CHANGED": "Tujuan diubah",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function toWibInput(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

function wibInputToIso(value: string) {
  const parsed = new Date(`${value}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function tripState(trip: TripDetail): { label: string; tone: string } {
  switch (trip.status) {
    case "COMPLETED":
      return { label: "Selesai", tone: "green" };
    case "DELIVERED":
      return { label: "Terkirim, menunggu review", tone: "green" };
    case "DELIVERY_IN_PROGRESS":
      return { label: "Penyaluran berlangsung", tone: "violet" };
    case "ARRIVAL_VERIFIED":
      return { label: "Tiba terverifikasi", tone: "green" };
    case "ARRIVAL_DETECTED":
      return { label: "Tiba, menunggu verifikasi", tone: "violet" };
    case "IN_TRANSIT":
      return { label: "Dalam perjalanan", tone: "blue" };
    case "READY_TO_DEPART":
      return { label: "Siap berangkat", tone: "amber" };
    case "SCHEDULED":
      return { label: "Terjadwal", tone: "blue" };
    case "CANCELLED":
      return { label: "Dibatalkan", tone: "red" };
    case "EXCEPTION":
      return { label: "Perlu perhatian", tone: "red" };
    default:
      return { label: "Draf", tone: "blue" };
  }
}

function exceptionLevel(exception: ExceptionSummary): { label: string; tone: string } {
  if (exception.severity === "CRITICAL") return { label: "Kritis", tone: "red" };
  if (exception.severity === "HIGH") return { label: "Tinggi", tone: "amber" };
  return { label: "Perhatian", tone: "violet" };
}

function StatusPill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{children}</span>;
}

function labelOf(labels: Record<string, string>, value: string) {
  return labels[value] ?? value.replaceAll("_", " ");
}

function eventLabel(event: TripEventSummary) {
  return eventLabels[event.eventType] ?? event.eventType.replaceAll(".", " · ").replaceAll("_", " ");
}

function eventTone(eventType: string) {
  if (eventType.includes("CANCELLED") || eventType.includes("OVERRIDDEN")) return "red";
  if (eventType.includes("ARRIVAL") || eventType.includes("COMPLETED")) return "green";
  if (eventType.includes("DELIVERY") || eventType.includes("POD")) return "violet";
  return "blue";
}

async function loadTripBundle(id: string): Promise<TripBundle> {
  const [detail, proofData, exceptionData] = await Promise.all([
    getTripDetail(id),
    getTripProofs(id).catch((error: unknown) => {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") throw error;
      return null;
    }),
    getTripExceptions(id).catch((error: unknown) => {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") throw error;
      return null;
    }),
  ]);
  return { detail, proofData, exceptionData };
}

function exceptionActionErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "EXCEPTION_CHANGED_RETRY":
      return "Exception sudah berubah. Muat ulang data lalu coba lagi.";
    case "EXCEPTION_TRANSITION_NOT_ALLOWED":
      return "Status exception tidak mengizinkan tindakan tersebut.";
    case "ASSIGNEE_NOT_FOUND":
      return "Akun penerima tugas tidak aktif atau tidak ditemukan.";
    case "EXCEPTION_NOT_FOUND":
      return "Exception tidak ditemukan atau berada di luar scope akses.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
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

function actionErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "TRIP_CHANGED_RETRY":
      return "Data trip sudah berubah. Muat ulang halaman lalu coba lagi.";
    case "ILLEGAL_TRIP_TRANSITION":
      return "Status trip tidak mengizinkan aksi ini.";
    case "TRIP_NOT_RESCHEDULABLE":
      return "Jadwal hanya dapat diubah saat trip masih draf atau terjadwal.";
    case "TRIP_NOT_REASSIGNABLE":
      return "Kendaraan dan pengemudi hanya dapat diganti saat trip masih draf atau terjadwal.";
    case "DESTINATION_CHANGE_REQUIRES_EXCEPTION":
      return "Tujuan tidak dapat diubah setelah perjalanan dimulai.";
    case "RESOURCE_ALREADY_ASSIGNED":
      return "Kendaraan atau pengemudi sudah dipakai pada rentang waktu tersebut.";
    case "RESOURCE_ASSIGNMENT_CONFLICT_RETRY":
      return "Terjadi bentrok penugasan bersamaan. Coba lagi.";
    case "VEHICLE_NOT_AVAILABLE":
      return "Kendaraan tidak aktif atau bukan milik SPPG trip ini.";
    case "DRIVER_NOT_AVAILABLE":
      return "Pengemudi tidak aktif atau bukan milik SPPG trip ini.";
    case "INVALID_DESTINATION":
      return "Tujuan tidak valid untuk organisasi SPPG trip ini.";
    case "INVALID_TRIP_SCHEDULE":
      return "Waktu tiba harus setelah waktu berangkat.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk aksi ini.";
    case "REQUEST_FAILED_404":
      return "Trip tidak ditemukan atau berada di luar scope akses.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    default:
      return "Aksi gagal diproses. Periksa koneksi API lalu coba lagi.";
  }
}

function deliveryActionErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "DELIVERY_NOT_IN_PROGRESS":
      return "Serah-terima belum dimulai atau sudah disubmit.";
    case "DISPATCH_QUANTITY_REQUIRED":
      return "Jumlah porsi yang dikirim belum tersedia.";
    case "DELIVERY_QUANTITY_EXCEEDS_DISPATCH":
      return "Jumlah diterima dan rusak tidak boleh melebihi jumlah yang dikirim.";
    case "VARIANCE_REASON_REQUIRED":
      return "Alasan selisih wajib diisi karena ada porsi kurang atau rusak.";
    case "CORRECTION_REASON_REQUIRED":
      return "Alasan koreksi wajib diisi saat memperbaiki POD yang ditolak.";
    case "DELIVERY_RECORD_ALREADY_SUBMITTED":
      return "POD sudah disubmit. Muat ulang data untuk melihat status terbaru.";
    case "DELIVERY_REVIEW_NOT_PENDING":
      return "POD tidak berada dalam status menunggu review.";
    case "SELF_REVIEW_FORBIDDEN":
      return "Review harus dilakukan oleh pengguna selain penerima POD.";
    case "DELIVERY_RECONCILIATION_REQUIRED":
      return "Trip belum dapat diselesaikan sebelum POD diterima reviewer.";
    case "TRIP_CHANGED_RETRY":
      return "Data trip sudah berubah. Muat ulang halaman lalu coba lagi.";
    case "ILLEGAL_TRIP_TRANSITION":
      return "Status trip tidak mengizinkan aksi ini.";
    case "IDEMPOTENCY_KEY_REUSED":
      return "Permintaan sebelumnya berbeda. Tutup dialog lalu coba lagi.";
    case "CSRF_INVALID":
    case "CSRF_UNAVAILABLE":
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case "REQUEST_FAILED_403":
    case "FORBIDDEN":
      return "Peran Anda tidak memiliki izin untuk aksi POD ini.";
    case "TRIP_NOT_FOUND":
    case "REQUEST_FAILED_404":
      return "Trip tidak ditemukan atau berada di luar scope akses.";
    case "API_NOT_CONFIGURED":
      return "Alamat API belum dikonfigurasi.";
    default:
      return "Aksi POD gagal diproses. Periksa koneksi API lalu coba lagi.";
  }
}

function TripDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [reloadKey, setReloadKey] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [proofs, setProofs] = useState<ProofSummary[] | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionSummary[] | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editDepartureAt, setEditDepartureAt] = useState("");
  const [editArrivalAt, setEditArrivalAt] = useState("");
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editDriverId, setEditDriverId] = useState("");
  const [editDestinationId, setEditDestinationId] = useState("");
  const [actionOptions, setActionOptions] = useState<TripResourceOptions | null>(null);
  const [actionOptionsState, setActionOptionsState] = useState<OptionsState>("idle");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [exceptionTarget, setExceptionTarget] = useState<ExceptionSummary | null>(null);
  const [exceptionAction, setExceptionAction] = useState<ExceptionAction>("triage");
  const [exceptionSeverity, setExceptionSeverity] = useState<ExceptionSummary["severity"]>("ATTENTION");
  const [exceptionOutcome, setExceptionOutcome] = useState<ExceptionCloseOutcome>("CLOSED_WITH_NOTE");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionNote, setExceptionNote] = useState("");
  const [exceptionResolution, setExceptionResolution] = useState("");
  const [exceptionBusy, setExceptionBusy] = useState(false);
  const [exceptionError, setExceptionError] = useState("");
  const [deliveryAction, setDeliveryAction] = useState<DeliveryAction | null>(null);
  const [podReceived, setPodReceived] = useState("");
  const [podDamaged, setPodDamaged] = useState("");
  const [podReason, setPodReason] = useState("");
  const [podNote, setPodNote] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");

  useEffect(() => {
    let active = true;

    if (!id) return;

    void (async () => {
      setLoadState("checking");
      let user: SessionUser;
      try {
        user = await getCurrentSession();
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setLoadState("unavailable");
        return;
      }
      if (!active) return;
      setSessionUser(user);

      try {
        const { detail, proofData, exceptionData } = await loadTripBundle(id);
        if (!active) return;
        setTrip(detail);
        setProofs(proofData);
        setExceptions(exceptionData);
        setLoadState("ready");
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof Error && error.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setLoadState(
          error instanceof Error && error.message === "REQUEST_FAILED_404"
            ? "notfound"
            : "data-error",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [id, reloadKey, router]);

  useEffect(() => {
    if (!pendingAction) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !actionBusy) {
        setPendingAction(null);
        setActionError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actionBusy, pendingAction]);

  useEffect(() => {
    if (!exceptionTarget) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !exceptionBusy) {
        setExceptionTarget(null);
        setExceptionError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exceptionBusy, exceptionTarget]);

  useEffect(() => {
    if (!deliveryAction) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deliveryBusy) {
        setDeliveryAction(null);
        setDeliveryError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deliveryAction, deliveryBusy]);

  async function loadActionOptions() {
    if (!trip) return;
    setActionOptionsState("loading");
    try {
      const result = await getTripResourceOptions(trip.sppg.id);
      setActionOptions(result);
      setActionOptionsState("ready");
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setActionOptionsState("error");
    }
  }

  function openAction(action: PendingAction) {
    setPendingAction(action);
    setCancelReason("");
    setEditReason("");
    setActionError("");
    setActionNotice("");

    if (trip) {
      if (action === "reschedule") {
        setEditDepartureAt(toWibInput(trip.plannedDepartureAt));
        setEditArrivalAt(toWibInput(trip.plannedArrivalAt));
      } else if (action === "reassign") {
        setEditVehicleId(trip.vehicle.id);
        setEditDriverId(trip.driver.id);
      } else if (action === "destination") {
        setEditDestinationId(trip.deliveryLocation.id);
      }
    }

    if (
      (action === "reassign" || action === "destination") &&
      actionOptionsState !== "ready" &&
      actionOptionsState !== "loading"
    ) {
      void loadActionOptions();
    }
  }

  function closeAction() {
    if (actionBusy) return;
    setPendingAction(null);
    setActionError("");
  }

  function openDeliveryAction(action: DeliveryAction) {
    if (!trip) return;
    const record = trip.deliveryRecords[0] ?? null;
    setDeliveryAction(action);
    setDeliveryError("");
    setActionNotice("");

    if (action === "pod") {
      const source = record?.reviewStatus === "REJECTED" ? record : null;
      setPodReceived(String(source?.receivedQuantity ?? trip.dispatchedQuantity ?? trip.plannedQuantity));
      setPodDamaged(String(source?.damagedQuantity ?? 0));
      setPodReason("");
      setPodNote("");
    } else if (action === "review-accept" || action === "review-reject") {
      setReviewReason("");
    }
  }

  function closeDeliveryAction() {
    if (deliveryBusy) return;
    setDeliveryAction(null);
    setDeliveryError("");
  }

  async function submitDeliveryAction() {
    if (!trip || !deliveryAction || deliveryBusy) return;
    const record = trip.deliveryRecords[0] ?? null;
    const dispatched = record?.dispatchedQuantity ?? trip.dispatchedQuantity;
    const isCorrection = trip.status === "DELIVERED" && record?.reviewStatus === "REJECTED";
    setDeliveryError("");

    if (deliveryAction === "pod") {
      if (dispatched === null) {
        setDeliveryError("Jumlah porsi yang dikirim belum tersedia.");
        return;
      }
      const received = Number(podReceived);
      const damaged = Number(podDamaged);
      if (
        !Number.isSafeInteger(received) ||
        received < 0 ||
        !Number.isSafeInteger(damaged) ||
        damaged < 0 ||
        received > 100_000 ||
        damaged > 100_000
      ) {
        setDeliveryError("Jumlah diterima dan rusak harus berupa bilangan bulat 0-100000.");
        return;
      }
      if (received + damaged > dispatched) {
        setDeliveryError("Jumlah diterima dan rusak tidak boleh melebihi jumlah yang dikirim.");
        return;
      }
      const hasVariance = received + damaged < dispatched || damaged > 0;
      if ((hasVariance || isCorrection) && podReason.trim().length < 3) {
        setDeliveryError(
          isCorrection
            ? "Alasan koreksi wajib diisi minimal 3 karakter."
            : "Alasan selisih wajib diisi minimal 3 karakter.",
        );
        return;
      }
    } else if (
      (deliveryAction === "review-accept" || deliveryAction === "review-reject") &&
      reviewReason.trim().length < 3
    ) {
      setDeliveryError("Alasan review wajib diisi minimal 3 karakter.");
      return;
    }

    setDeliveryBusy(true);

    try {
      let notice: string;
      if (deliveryAction === "start") {
        await startTripDelivery(trip.id);
        notice = "Serah-terima dimulai. Form POD sekarang tersedia.";
      } else if (deliveryAction === "pod") {
        const submitted = await submitTripDelivery(trip.id, {
          receivedQuantity: Number(podReceived),
          damagedQuantity: Number(podDamaged),
          ...(podReason.trim() ? { varianceReason: podReason.trim() } : {}),
          ...(podNote.trim() ? { confirmationNote: podNote.trim() } : {}),
          deviceTimestamp: new Date().toISOString(),
        });
        notice = submitted.reviewStatus === "PENDING_REVIEW"
          ? "POD tersimpan dan menunggu review."
          : "POD tersimpan dan diterima otomatis.";
      } else if (deliveryAction === "review-accept") {
        await reviewTripDelivery(trip.id, {
          decision: "ACCEPT",
          reason: reviewReason.trim(),
        });
        notice = "POD diterima. Trip dapat diselesaikan.";
      } else if (deliveryAction === "review-reject") {
        await reviewTripDelivery(trip.id, {
          decision: "REJECT",
          reason: reviewReason.trim(),
        });
        notice = "POD ditolak. Penerima perlu mengirim koreksi.";
      } else {
        await completeTrip(trip.id);
        notice = "Trip berhasil diselesaikan.";
      }

      setDeliveryAction(null);
      setActionNotice(notice);

      try {
        const bundle = await loadTripBundle(trip.id);
        setTrip(bundle.detail);
        setProofs(bundle.proofData);
        setExceptions(bundle.exceptionData);
      } catch (refreshError: unknown) {
        if (refreshError instanceof Error && refreshError.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setActionNotice(`${notice} Detail terbaru gagal dimuat; gunakan Muat ulang.`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setDeliveryError(deliveryActionErrorMessage(error));
    } finally {
      setDeliveryBusy(false);
    }
  }

  function changeEditDeparture(value: string) {
    setEditDepartureAt(value);
    const departure = wibInputToIso(value);
    const arrival = wibInputToIso(editArrivalAt);
    if (departure && (!arrival || new Date(arrival) <= new Date(departure))) {
      setEditArrivalAt(toWibInput(new Date(new Date(departure).getTime() + 2 * 60 * 60_000)));
    }
  }

  async function submitAction() {
    if (!pendingAction || !trip || actionBusy) return;

    if (pendingAction === "cancel" && cancelReason.trim().length < 3) {
      setActionError("Alasan pembatalan wajib diisi minimal 3 karakter.");
      return;
    }
    if (pendingAction !== "schedule" && pendingAction !== "ready" && pendingAction !== "cancel") {
      if (editReason.trim().length < 3) {
        setActionError("Alasan perubahan wajib diisi minimal 3 karakter.");
        return;
      }
    }

    let plannedDepartureAt = "";
    let plannedArrivalAt = "";
    if (pendingAction === "reschedule") {
      plannedDepartureAt = wibInputToIso(editDepartureAt);
      plannedArrivalAt = wibInputToIso(editArrivalAt);
      if (!plannedDepartureAt || !plannedArrivalAt) {
        setActionError("Jadwal berangkat dan tiba wajib diisi.");
        return;
      }
      if (new Date(plannedArrivalAt) <= new Date(plannedDepartureAt)) {
        setActionError("Waktu tiba harus setelah waktu berangkat.");
        return;
      }
      if (
        plannedDepartureAt === new Date(trip.plannedDepartureAt).toISOString() &&
        plannedArrivalAt === new Date(trip.plannedArrivalAt).toISOString()
      ) {
        setActionError("Jadwal tidak berubah.");
        return;
      }
    }
    if (pendingAction === "reassign" && (!editVehicleId || !editDriverId)) {
      setActionError("Kendaraan dan pengemudi wajib dipilih.");
      return;
    }
    if (
      pendingAction === "reassign" &&
      editVehicleId === trip.vehicle.id &&
      editDriverId === trip.driver.id
    ) {
      setActionError("Pilih kendaraan atau pengemudi yang berbeda.");
      return;
    }
    if (pendingAction === "destination" && editDestinationId === trip.deliveryLocation.id) {
      setActionError("Pilih tujuan yang berbeda dari tujuan saat ini.");
      return;
    }
    if (
      (pendingAction === "reassign" || pendingAction === "destination") &&
      actionOptionsState !== "ready"
    ) {
      setActionError("Master data belum siap. Muat ulang pilihan lalu coba lagi.");
      return;
    }
    if (pendingAction === "destination" && !editDestinationId) {
      setActionError("Tujuan pengiriman wajib dipilih.");
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      if (pendingAction === "schedule") {
        await scheduleTrip(trip.id);
      } else if (pendingAction === "ready") {
        await readyTrip(trip.id);
      } else if (pendingAction === "cancel") {
        await cancelTrip(trip.id, trip.version, cancelReason.trim());
      } else if (pendingAction === "reschedule") {
        await rescheduleTrip(trip.id, {
          plannedDepartureAt,
          plannedArrivalAt,
          version: trip.version,
          reason: editReason.trim(),
        });
      } else if (pendingAction === "reassign") {
        await reassignTrip(trip.id, {
          vehicleId: editVehicleId,
          driverId: editDriverId,
          version: trip.version,
          reason: editReason.trim(),
        });
      } else {
        await changeTripDestination(trip.id, {
          deliveryLocationId: editDestinationId,
          version: trip.version,
          reason: editReason.trim(),
        });
      }

      const notice = pendingAction === "schedule"
        ? "Trip berhasil dijadwalkan."
        : pendingAction === "ready"
          ? "Trip ditandai siap berangkat."
          : pendingAction === "cancel"
            ? "Trip berhasil dibatalkan."
            : pendingAction === "reschedule"
              ? "Jadwal trip berhasil diubah."
              : pendingAction === "reassign"
                ? "Kendaraan dan pengemudi berhasil diganti."
                : "Tujuan trip berhasil diubah.";
      setPendingAction(null);
      setCancelReason("");
      setEditReason("");
      setActionNotice(notice);

      try {
        const bundle = await loadTripBundle(trip.id);
        setTrip(bundle.detail);
        setProofs(bundle.proofData);
        setExceptions(bundle.exceptionData);
      } catch (refreshError: unknown) {
        if (refreshError instanceof Error && refreshError.message === "UNAUTHENTICATED") {
          router.replace("/login?expired=1");
          return;
        }
        setActionNotice(`${notice} Detail terbaru gagal dimuat; gunakan Muat ulang.`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setActionError(actionErrorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  function openExceptionAction(exception: ExceptionSummary) {
    if (exceptionBusy) return;
    setExceptionTarget(exception);
    setExceptionAction(defaultExceptionAction(exception.status));
    setExceptionSeverity(exception.severity);
    setExceptionOutcome("CLOSED_WITH_NOTE");
    setExceptionReason("");
    setExceptionNote("");
    setExceptionResolution("");
    setExceptionError("");
  }

  function closeExceptionAction() {
    if (exceptionBusy) return;
    setExceptionTarget(null);
    setExceptionError("");
  }

  async function submitExceptionAction() {
    if (!exceptionTarget || !sessionUser || exceptionBusy) return;
    setExceptionError("");

    if (exceptionReason.trim().length < 3) {
      setExceptionError("Alasan tindakan wajib diisi minimal 3 karakter.");
      return;
    }
    if (exceptionNote.trim().length > 0 && exceptionNote.trim().length < 3) {
      setExceptionError("Catatan tambahan minimal 3 karakter atau kosongkan.");
      return;
    }
    if (exceptionAction === "resolve" && exceptionResolution.trim().length < 3) {
      setExceptionError("Catatan resolusi wajib diisi minimal 3 karakter.");
      return;
    }
    if (
      exceptionAction === "close" &&
      exceptionOutcome === "CLOSED_WITH_NOTE" &&
      exceptionNote.trim().length < 3
    ) {
      setExceptionError("Penutupan dengan catatan wajib menyertakan catatan minimal 3 karakter.");
      return;
    }

    setExceptionBusy(true);
    const base = {
      version: exceptionTarget.version,
      reason: exceptionReason.trim(),
      ...(exceptionNote.trim() ? { note: exceptionNote.trim() } : {}),
    };

    try {
      if (exceptionAction === "triage") {
        await triageException(exceptionTarget.id, {
          ...base,
          severity: exceptionSeverity,
        });
      } else if (exceptionAction === "assign") {
        await assignException(exceptionTarget.id, {
          ...base,
          assigneeUserId: sessionUser.id,
        });
      } else if (exceptionAction === "investigate") {
        await investigateException(exceptionTarget.id, base);
      } else if (exceptionAction === "resolve") {
        await resolveException(exceptionTarget.id, {
          version: exceptionTarget.version,
          reason: exceptionReason.trim(),
          resolutionNote: exceptionResolution.trim(),
        });
      } else if (exceptionAction === "escalate") {
        await escalateException(exceptionTarget.id, base);
      } else {
        await closeException(exceptionTarget.id, {
          ...base,
          outcome: exceptionOutcome,
        });
      }

      const notice = {
        triage: "Exception berhasil ditriage.",
        assign: "Exception berhasil ditugaskan kepada Anda.",
        investigate: "Investigasi exception dimulai.",
        resolve: "Exception berhasil diselesaikan.",
        escalate: "Exception berhasil dieskalasi.",
        close: "Exception berhasil ditutup.",
      }[exceptionAction];
      setExceptionTarget(null);
      setActionNotice(notice);

      if (trip) {
        try {
          const bundle = await loadTripBundle(trip.id);
          setTrip(bundle.detail);
          setProofs(bundle.proofData);
          setExceptions(bundle.exceptionData);
        } catch (refreshError: unknown) {
          if (refreshError instanceof Error && refreshError.message === "UNAUTHENTICATED") {
            router.replace("/login?expired=1");
            return;
          }
          setActionNotice(`${notice} Daftar terbaru gagal dimuat; gunakan Muat ulang.`);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
        return;
      }
      setExceptionError(exceptionActionErrorMessage(error));
    } finally {
      setExceptionBusy(false);
    }
  }

  if (!id || loadState === "notfound") {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Perjalanan tidak ditemukan</h1>
        <p>Trip tidak tersedia atau berada di luar scope akses Anda.</p>
        <Link className="session-retry" href="/"><ArrowLeft size={14} />Kembali</Link>
      </main>
    );
  }

  if (loadState === "checking") {
    return (
      <main className="session-state">
        <span className="session-spinner" />
        <p>Memuat detail perjalanan...</p>
      </main>
    );
  }

  if (loadState === "unavailable") {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Layanan belum tersedia</h1>
        <p>Detail perjalanan tidak dapat memverifikasi sesi. Pastikan API dan PostgreSQL aktif.</p>
        <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>Coba lagi</button>
      </main>
    );
  }

  if (loadState === "data-error" || !trip || !sessionUser) {
    return (
      <main className="session-state">
        <span className="session-error-mark">!</span>
        <h1>Detail gagal dimuat</h1>
        <p>Sesi valid, tetapi detail trip tidak dapat dimuat dari API.</p>
        <div className="trip-error-actions">
          <Link className="session-retry" href="/"><ArrowLeft size={14} />Kembali</Link>
          <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw size={14} />Coba lagi
          </button>
        </div>
      </main>
    );
  }

  const state = tripState(trip);
  const currentRecord = trip.deliveryRecords[0] ?? null;
  const activeExceptions = (exceptions ?? []).filter(
    (exception) => !closedExceptionStatuses.has(exception.status),
  );
  const latestPosition = trip.positions[0] ?? null;
  const timeline = [...trip.events].reverse();
  const routeTitle = `${trip.sppg.name} ke ${trip.deliveryLocation.name}`;
  const receivedQuantity = currentRecord?.receivedQuantity ?? trip.receivedQuantity;
  const dispatchedQuantity = currentRecord?.dispatchedQuantity ?? trip.dispatchedQuantity;
  const canSchedule = hasPermission(sessionUser, "trip:schedule") && trip.status === "DRAFT";
  const canReady = hasPermission(sessionUser, "trip:dispatch") && trip.status === "SCHEDULED";
  const canCancel = hasPermission(sessionUser, "trip:manage") && cancellableStatuses.has(trip.status);
  const canEdit = editableStatuses.has(trip.status);
  const canReadMasters = hasPermission(sessionUser, "master:read");
  const canReschedule = hasPermission(sessionUser, "trip:schedule") && canEdit;
  const canReassign = hasPermission(sessionUser, "trip:dispatch") && canEdit && canReadMasters;
  const canChangeDestination = hasPermission(sessionUser, "trip:manage") && canEdit && canReadMasters;
  const canManageExceptions = hasPermission(sessionUser, "exception:manage");
  const showActionBar = canSchedule || canReady || canCancel || canReschedule || canReassign || canChangeDestination;
  const canStartDelivery = hasPermission(sessionUser, "delivery:start") && trip.status === "ARRIVAL_VERIFIED";
  const podRejected = trip.status === "DELIVERED" && currentRecord?.reviewStatus === "REJECTED";
  const canSubmitPod = hasPermission(sessionUser, "delivery:confirm") &&
    (trip.status === "DELIVERY_IN_PROGRESS" || podRejected);
  const canReviewPod = hasPermission(sessionUser, "delivery:review") &&
    trip.status === "DELIVERED" &&
    currentRecord?.reviewStatus === "PENDING_REVIEW";
  const canCompleteDelivery = hasPermission(sessionUser, "trip:complete") &&
    trip.status === "DELIVERED" &&
    currentRecord?.reviewStatus === "ACCEPTED" &&
    trip.deliveryStatus !== "UNDER_REVIEW";
  const showDeliveryBar = canStartDelivery || canSubmitPod || canReviewPod || canCompleteDelivery;
  const deliveryGuide = canStartDelivery
    ? "Kedatangan terverifikasi. Mulai serah-terima untuk membuka pencatatan POD."
    : canSubmitPod
      ? podRejected
        ? "POD ditolak reviewer. Kirim koreksi jumlah dan alasan perbaikan."
        : "Penyaluran berlangsung. Catat porsi diterima, rusak, dan catatan serah-terima."
      : canReviewPod
        ? "POD menunggu keputusan reviewer. Terima atau tolak dengan alasan yang jelas."
        : "POD sudah diterima. Selesaikan trip untuk menutup perjalanan.";
  const modalDispatched = currentRecord?.dispatchedQuantity ?? trip.dispatchedQuantity;
  const podReceivedValue = Number(podReceived);
  const podDamagedValue = Number(podDamaged);
  const podQuantityValid =
    Number.isSafeInteger(podReceivedValue) &&
    podReceivedValue >= 0 &&
    podReceivedValue <= 100_000 &&
    Number.isSafeInteger(podDamagedValue) &&
    podDamagedValue >= 0 &&
    podDamagedValue <= 100_000 &&
    modalDispatched !== null &&
    podReceivedValue + podDamagedValue <= modalDispatched;
  const podHasVariance = podQuantityValid &&
    modalDispatched !== null &&
    (podReceivedValue + podDamagedValue < modalDispatched || podDamagedValue > 0);
  const podNeedsReason = podHasVariance || podRejected;
  const podShortage = podQuantityValid && modalDispatched !== null
    ? modalDispatched - podReceivedValue - podDamagedValue
    : null;
  const deliveryModalCopy = deliveryAction
    ? {
      start: {
        title: "Mulai serah-terima?",
        description: "Status trip berubah menjadi Penyaluran berlangsung dan form POD akan tersedia.",
      },
      pod: {
        title: podRejected ? "Kirim koreksi POD?" : "Submit POD?",
        description: podRejected
          ? "Koreksi akan disimpan sebagai versi baru tanpa menghapus riwayat POD sebelumnya."
          : "Angka rencana, dikirim, dan diterima tetap terpisah. Selisih akan masuk review.",
      },
      "review-accept": {
        title: "Terima POD?",
        description: "POD diterima dan trip dapat diselesaikan setelah rekonsiliasi ini.",
      },
      "review-reject": {
        title: "Tolak POD?",
        description: "Penerima perlu mengirim ulang POD dengan koreksi. Alasan akan tercatat pada audit.",
      },
      complete: {
        title: "Selesaikan perjalanan?",
        description: "Trip akan ditutup, tracking dihentikan, dan status akhir menjadi Selesai.",
      },
    }[deliveryAction]
    : null;
  const exceptionActionOptions = exceptionTarget ? exceptionActionsFor(exceptionTarget.status) : [];
  const exceptionActionCopy = {
    triage: {
      title: "Triage exception",
      description: "Tetapkan tingkat keparahan sebelum kasus ditugaskan atau dieskalasi.",
    },
    assign: {
      title: "Tugaskan exception kepada Anda?",
      description: "Kasus akan menjadi tanggung jawab Anda. Pastikan Anda memegang scope SPPG terkait.",
    },
    investigate: {
      title: "Mulai investigasi?",
      description: "Status kasus berubah menjadi investigasi dan tindak lanjut dicatat pada audit.",
    },
    resolve: {
      title: "Selesaikan exception?",
      description: "Isi catatan resolusi yang jelas. Kasus tetap dapat ditutup dengan outcome akhir.",
    },
    escalate: {
      title: "Eskalasi exception?",
      description: "Gunakan eskalasi bila kasus memerlukan perhatian atau kewenangan lebih tinggi.",
    },
    close: {
      title: "Tutup exception?",
      description: "Penutupan bersifat final. Pilih outcome yang sesuai dan sertakan alasan.",
    },
  }[exceptionAction];
  const actionGuide = trip.status === "DRAFT"
    ? "Trip masih draf. Lengkapi jadwal dan armada, lalu jadwalkan."
    : trip.status === "SCHEDULED"
      ? "Trip terjadwal. Perubahan masih dapat dilakukan sebelum siap berangkat."
      : "Trip siap berangkat. Hanya pembatalan yang tersedia dari control tower.";
  const modalCopy = {
    schedule: {
      title: "Jadwalkan perjalanan?",
      description: "Trip akan masuk status Terjadwal dan siap ditandai berangkat oleh dispatcher.",
    },
    ready: {
      title: "Tandai siap berangkat?",
      description: "Pastikan kendaraan dan pengemudi sudah siap. Driver tetap memulai trip dari lokasi SPPG dengan GPS.",
    },
    cancel: {
      title: "Batalkan perjalanan?",
      description: "Pembatalan tidak dapat dibatalkan dari UI. Alasan akan dicatat pada event dan audit.",
    },
    reschedule: {
      title: "Ubah jadwal perjalanan?",
      description: "Jadwal baru akan menggantikan rencana sebelumnya dan tercatat pada event serta audit.",
    },
    reassign: {
      title: "Ganti kendaraan dan pengemudi?",
      description: "Hanya kendaraan dan pengemudi aktif dari SPPG ini yang dapat dipilih.",
    },
    destination: {
      title: "Ubah tujuan pengiriman?",
      description: "Tujuan baru harus berada dalam organisasi SPPG yang sama dan belum melewati batas keberangkatan.",
    },
  }[pendingAction ?? "cancel"];
  const actionDestinationOptions = (actionOptions?.deliveryLocations ?? []).filter(
    (location) => location.active,
  );
  const actionVehicleOptions = (actionOptions?.vehicles ?? []).filter(
    (vehicle) => vehicle.status === "ACTIVE" && vehicle.sppgId === trip.sppg.id,
  );
  const actionDriverOptions = (actionOptions?.drivers ?? []).filter(
    (driver) => driver.status === "ACTIVE" && driver.sppgId === trip.sppg.id,
  );
  const needsActionOptions = pendingAction === "reassign" || pendingAction === "destination";
  const editAction = pendingAction === "reschedule" || pendingAction === "reassign" || pendingAction === "destination";
  const missingEditFields =
    (pendingAction === "reschedule" && (!editDepartureAt || !editArrivalAt)) ||
    (pendingAction === "reassign" && (
      !editVehicleId ||
      !editDriverId ||
      actionVehicleOptions.length === 0 ||
      actionDriverOptions.length === 0
    )) ||
    (pendingAction === "destination" && (!editDestinationId || actionDestinationOptions.length === 0));

  return (
    <main className="trip-page">
      <header className="trip-topbar">
        <Link className="trip-back" href="/">
          <ArrowLeft size={15} />
          Ringkasan
        </Link>
        <Link className="trip-brand" href="/" aria-label="RADAR MBG beranda">
          <span className="brand-mark"><span /><span /><span /></span>
          <strong>RADAR<span>MBG</span></strong>
        </Link>
        <HeaderAccount user={sessionUser} />
      </header>

      <div className="trip-content">
        <div className="trip-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              TRP-{trip.id.slice(0, 8).toUpperCase()}
            </div>
            <h1>{routeTitle}</h1>
            <p>
              {trip.deliveryLocation.address ?? "Alamat tujuan belum tersedia"}
              <span className="trip-heading-separator">·</span>
              {trip.vehicle.plateNumber} · {trip.driver.name}
            </p>
          </div>
          <div className="trip-heading-actions">
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
            <button className="session-retry" onClick={() => setReloadKey((value) => value + 1)}>
              <RefreshCw size={14} />
              Muat ulang
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="trip-action-notice" role="status">
            <CheckCircle2 size={16} />
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice("")} aria-label="Tutup notifikasi"><X size={14} /></button>
          </div>
        )}

        {showActionBar && (
          <section className="panel trip-action-bar" aria-label="Aksi perjalanan">
            <div className="trip-action-copy">
              <span className="trip-action-icon"><CalendarClock size={17} /></span>
              <div>
                <strong>Aksi perjalanan</strong>
                <p>{actionGuide}</p>
              </div>
            </div>
            <div className="trip-action-buttons">
              {canSchedule && (
                <button className="trip-action-button primary" onClick={() => openAction("schedule")}>
                  <CalendarClock size={14} />
                  Jadwalkan
                </button>
              )}
              {canReady && (
                <button className="trip-action-button primary" onClick={() => openAction("ready")}>
                  <Truck size={14} />
                  Siap berangkat
                </button>
              )}
              {canReschedule && (
                <button className="trip-action-button muted" onClick={() => openAction("reschedule")}>
                  <CalendarClock size={14} />
                  Ubah jadwal
                </button>
              )}
              {canReassign && (
                <button className="trip-action-button muted" onClick={() => openAction("reassign")}>
                  <Truck size={14} />
                  Ganti armada
                </button>
              )}
              {canChangeDestination && (
                <button className="trip-action-button muted" onClick={() => openAction("destination")}>
                  <MapPin size={14} />
                  Ubah tujuan
                </button>
              )}
              {canCancel && (
                <button className="trip-action-button danger" onClick={() => openAction("cancel")}>
                  <X size={14} />
                  Batalkan
                </button>
              )}
            </div>
          </section>
        )}

        <section className="trip-kpis" aria-label="Ringkasan perjalanan">
          <article className="panel trip-kpi">
            <span className="trip-kpi-icon icon-blue"><Clock3 size={17} /></span>
            <div><span>Jadwal</span><strong>{formatClock(trip.plannedDepartureAt)} - {formatClock(trip.plannedArrivalAt)}</strong><small>{formatDateTime(trip.plannedDepartureAt)}</small></div>
          </article>
          <article className="panel trip-kpi">
            <span className="trip-kpi-icon icon-green"><PackageCheck size={17} /></span>
            <div><span>Porsi</span><strong>{receivedQuantity ?? dispatchedQuantity ?? trip.plannedQuantity} / {trip.plannedQuantity}</strong><small>{currentRecord ? `POD versi ${currentRecord.version} · ${labelOf(reviewLabels, currentRecord.reviewStatus)}` : "POD belum disubmit"}</small></div>
          </article>
          <article className="panel trip-kpi">
            <span className="trip-kpi-icon icon-violet"><MapPin size={17} /></span>
            <div><span>GPS</span><strong>{latestPosition ? relativeTime(latestPosition.serverReceivedAt) : "Belum tersedia"}</strong><small>{latestPosition ? `Akurasi ${Number(latestPosition.accuracyMeters ?? 0).toFixed(0)} m · ${labelOf(trackingLabels, trip.trackingStatus)}` : labelOf(trackingLabels, trip.trackingStatus)}</small></div>
          </article>
          <article className="panel trip-kpi">
            <span className="trip-kpi-icon icon-amber"><AlertTriangle size={17} /></span>
            <div><span>Exception aktif</span><strong>{exceptions === null ? "—" : activeExceptions.length}</strong><small>{exceptions === null ? "Daftar exception tidak tersedia" : (activeExceptions[0]?.title ?? "Tidak ada exception aktif")}</small></div>
          </article>
        </section>

        <div className="trip-detail-grid">
          <div className="trip-detail-main">
            <section className="panel trip-map-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Posisi terakhir</h2><span className="sample-tag"><span />GPS</span></div>
                  <p>{latestPosition ? `Diterima server ${formatDateTime(latestPosition.serverReceivedAt)}` : "Belum ada posisi GPS untuk trip ini"}</p>
                </div>
              </div>
              <div className="trip-map-frame">
                <FleetMap trips={[trip]} />
              </div>
            </section>

            <section className="panel trip-timeline-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-title-row"><h2>Riwayat perjalanan</h2><span className="count-chip">{timeline.length}</span></div>
                  <p>Event server-side dari pembuatan sampai status terakhir</p>
                </div>
              </div>
              {timeline.length ? (
                <ol className="trip-timeline">
                  {timeline.map((event) => (
                    <li key={event.id}>
                      <span className={`timeline-dot timeline-${eventTone(event.eventType)}`} />
                      <div>
                        <strong>{eventLabel(event)}</strong>
                        <span>{formatDateTime(event.occurredAt)}{event.toStatus ? ` · ${labelOf(tripStatusLabels, event.toStatus)}` : ""}</span>
                        {event.reason && <small>{event.reason}</small>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="trip-empty">Belum ada event untuk trip ini.</div>
              )}
            </section>
          </div>

          <aside className="trip-detail-side">
            <section className="panel trip-side-panel">
              <div className="panel-heading">
                <div><div className="section-title-row"><h2>Rekonsiliasi POD</h2></div><p>Angka rencana, dikirim, dan diterima tetap terpisah</p></div>
              </div>
              {currentRecord ? (
                <div className="trip-quantity-grid">
                  <div><span>Rencana</span><strong>{currentRecord.plannedQuantity}</strong></div>
                  <div><span>Dikirim</span><strong>{currentRecord.dispatchedQuantity}</strong></div>
                  <div><span>Diterima</span><strong>{currentRecord.receivedQuantity}</strong></div>
                  <div><span>Rusak</span><strong>{currentRecord.damagedQuantity}</strong></div>
                  <div><span>Kurang</span><strong>{currentRecord.shortageQuantity}</strong></div>
                  <div><span>Versi</span><strong>{currentRecord.version}</strong></div>
                  <div className="trip-review-state"><span>Review</span><strong>{labelOf(reviewLabels, currentRecord.reviewStatus)}</strong>{currentRecord.reviewReason && <small>{currentRecord.reviewReason}</small>}</div>
                </div>
              ) : (
                <div className="trip-empty">POD belum disubmit. Completion belum dapat dilakukan.</div>
              )}
              {showDeliveryBar && (
                <div className="trip-pod-actions">
                  <p>{deliveryGuide}</p>
                  <div className="trip-pod-action-buttons">
                    {canStartDelivery && (
                      <button className="trip-action-button primary" onClick={() => openDeliveryAction("start")}>
                        <PackageCheck size={14} />
                        Mulai serah-terima
                      </button>
                    )}
                    {canSubmitPod && (
                      <button className="trip-action-button primary" onClick={() => openDeliveryAction("pod")}>
                        <CheckCircle2 size={14} />
                        {podRejected ? "Kirim koreksi POD" : "Submit POD"}
                      </button>
                    )}
                    {canReviewPod && (
                      <>
                        <button className="trip-action-button primary" onClick={() => openDeliveryAction("review-accept")}>
                          <CheckCircle2 size={14} />
                          Terima POD
                        </button>
                        <button className="trip-action-button danger" onClick={() => openDeliveryAction("review-reject")}>
                          <X size={14} />
                          Tolak POD
                        </button>
                      </>
                    )}
                    {canCompleteDelivery && (
                      <button className="trip-action-button primary" onClick={() => openDeliveryAction("complete")}>
                        <ShieldCheck size={14} />
                        Selesaikan trip
                      </button>
                    )}
                  </div>
                  {canReviewPod && (
                    <small>Review harus dilakukan pengguna selain penerima POD.</small>
                  )}
                </div>
              )}
            </section>

            <section className="panel trip-side-panel">
              <div className="panel-heading">
                <div><div className="section-title-row"><h2>Bukti POD</h2><span className="count-chip">{proofs?.length ?? 0}</span></div><p>Object storage privat, tautan berlaku 5 menit</p></div>
              </div>
              {proofs === null ? (
                <div className="trip-empty">Bukti tidak tersedia untuk peran ini atau storage belum dikonfigurasi.</div>
              ) : proofs.length ? (
                <div className="proof-list">
                  {proofs.map((proof) => (
                    <article className="proof-row" key={proof.id}>
                      <span className="proof-thumb">
                        {proof.url && proof.mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={proof.url} alt={proof.originalName ?? "Bukti POD"} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </span>
                      <div className="proof-copy">
                        <strong>{proof.originalName ?? "Bukti POD"}</strong>
                        <span>{formatBytes(proof.byteSize)} · {formatDateTime(proof.uploadedAt)}</span>
                        <small>SHA-256 {proof.sha256.slice(0, 12)}...</small>
                      </div>
                      {proof.url ? (
                        <a className="proof-open" href={proof.url} target="_blank" rel="noreferrer" aria-label="Buka bukti POD">
                          <ExternalLink size={15} />
                        </a>
                      ) : (
                        <span className="proof-open proof-open-disabled"><ExternalLink size={15} /></span>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="trip-empty">Belum ada bukti yang diunggah.</div>
              )}
            </section>

            <section className="panel trip-side-panel">
              <div className="panel-heading">
                <div><div className="section-title-row"><h2>Exception</h2><span className="count-chip">{exceptions === null ? "—" : exceptions.length}</span></div><p>Riwayat risiko dan gangguan terkait trip</p></div>
              </div>
              {exceptions === null ? (
                <div className="trip-empty">Daftar exception tidak tersedia untuk peran ini atau API sedang bermasalah.</div>
              ) : exceptions.length ? (
                <div className="trip-exception-list">
                  {exceptions.map((exception) => {
                    const level = exceptionLevel(exception);
                    const closed = closedExceptionStatuses.has(exception.status);
                    return (
                      <article className={closed ? "trip-exception-row trip-exception-closed" : "trip-exception-row"} key={exception.id}>
                        <span className={`alert-icon alert-${level.tone}`}>{exception.severity === "CRITICAL" ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}</span>
                        <div>
                          <strong>{exception.title}</strong>
                          <span>{labelOf(exceptionStatusLabels, exception.status)} · {relativeTime(exception.openedAt)}</span>
                        </div>
                        <StatusPill tone={level.tone}>{level.label}</StatusPill>
                        {canManageExceptions && !closed && (
                          <button
                            className="trip-exception-open"
                            onClick={() => openExceptionAction(exception)}
                            aria-label={`Tindak lanjuti ${exception.title}`}
                            title="Tindak lanjuti"
                          >
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="trip-empty">Tidak ada exception untuk trip ini.</div>
              )}
            </section>

            <section className="panel trip-side-panel">
              <div className="panel-heading">
                <div><div className="section-title-row"><h2>Informasi</h2></div></div>
              </div>
              <div className="trip-info-list">
                <div><span><Truck size={14} />Kendaraan</span><strong>{trip.vehicle.plateNumber}{trip.vehicle.label ? ` · ${trip.vehicle.label}` : ""}</strong></div>
                <div><span><UserRound size={14} />Pengemudi</span><strong>{trip.driver.name}</strong></div>
                <div><span><MapPin size={14} />Tujuan</span><strong>{trip.deliveryLocation.code} · {trip.deliveryLocation.name}</strong></div>
                <div><span><ArrowRight size={14} />Berangkat</span><strong>{trip.actualDepartureAt ? formatDateTime(trip.actualDepartureAt) : "Belum berangkat"}</strong></div>
                <div><span><ShieldCheck size={14} />Verifikasi</span><strong>{labelOf(verificationLabels, trip.verificationStatus)}</strong></div>
                <div><span><Clock3 size={14} />Selesai</span><strong>{trip.completedAt ? formatDateTime(trip.completedAt) : "Belum selesai"}</strong></div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {pendingAction && (
        <div
          className="trip-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAction();
          }}
        >
          <div className={`trip-modal ${editAction ? "trip-action-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="trip-action-title">
            <button className="trip-modal-close" onClick={closeAction} disabled={actionBusy} aria-label="Tutup dialog">
              <X size={17} />
            </button>
            <span className={`trip-modal-icon ${pendingAction === "cancel" ? "danger" : "primary"}`}>
              {pendingAction === "cancel"
                ? <AlertTriangle size={19} />
                : pendingAction === "reassign"
                  ? <Truck size={19} />
                  : pendingAction === "destination"
                    ? <MapPin size={19} />
                    : <CalendarClock size={19} />}
            </span>
            <h2 id="trip-action-title">{modalCopy.title}</h2>
            <p>{modalCopy.description}</p>

            {needsActionOptions && actionOptionsState !== "ready" ? (
              <div className="trip-action-options-state">
                {actionOptionsState === "error" ? (
                  <>
                    <AlertTriangle size={17} />
                    <strong>Pilihan armada/tujuan gagal dimuat</strong>
                    <span>Periksa koneksi API atau izin master data.</span>
                    <button className="trip-action-button muted" onClick={() => void loadActionOptions()}>Muat ulang pilihan</button>
                  </>
                ) : (
                  <>
                    <span className="session-spinner" />
                    <span>Memuat pilihan armada dan tujuan...</span>
                  </>
                )}
              </div>
            ) : (
              <>
                {pendingAction === "reschedule" && (
                  <div className="trip-form-grid">
                    <label className="trip-form-field" htmlFor="trip-edit-departure">
                      <span>Berangkat (WIB)</span>
                      <input
                        id="trip-edit-departure"
                        type="datetime-local"
                        value={editDepartureAt}
                        onChange={(event) => changeEditDeparture(event.target.value)}
                        disabled={actionBusy}
                      />
                    </label>
                    <label className="trip-form-field" htmlFor="trip-edit-arrival">
                      <span>Tiba (WIB)</span>
                      <input
                        id="trip-edit-arrival"
                        type="datetime-local"
                        value={editArrivalAt}
                        onChange={(event) => setEditArrivalAt(event.target.value)}
                        disabled={actionBusy}
                      />
                    </label>
                  </div>
                )}

                {pendingAction === "reassign" && (
                  <div className="trip-form-grid">
                    <label className="trip-form-field" htmlFor="trip-edit-vehicle">
                      <span><Truck size={12} />Kendaraan</span>
                      <select
                        id="trip-edit-vehicle"
                        value={editVehicleId}
                        onChange={(event) => setEditVehicleId(event.target.value)}
                        disabled={actionBusy}
                      >
                        <option value="">Pilih kendaraan</option>
                        {actionVehicleOptions.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.plateNumber}{vehicle.label ? ` · ${vehicle.label}` : ""}
                          </option>
                        ))}
                      </select>
                      {actionVehicleOptions.length === 0 && <small>Tidak ada kendaraan aktif untuk SPPG ini.</small>}
                    </label>
                    <label className="trip-form-field" htmlFor="trip-edit-driver">
                      <span><UserRound size={12} />Pengemudi</span>
                      <select
                        id="trip-edit-driver"
                        value={editDriverId}
                        onChange={(event) => setEditDriverId(event.target.value)}
                        disabled={actionBusy}
                      >
                        <option value="">Pilih pengemudi</option>
                        {actionDriverOptions.map((driver) => (
                          <option key={driver.id} value={driver.id}>{driver.code} · {driver.name}</option>
                        ))}
                      </select>
                      {actionDriverOptions.length === 0 && <small>Tidak ada pengemudi aktif untuk SPPG ini.</small>}
                    </label>
                  </div>
                )}

                {pendingAction === "destination" && (
                  <label className="trip-form-field" htmlFor="trip-edit-destination">
                    <span><MapPin size={12} />Tujuan pengiriman</span>
                    <select
                      id="trip-edit-destination"
                      value={editDestinationId}
                      onChange={(event) => setEditDestinationId(event.target.value)}
                      disabled={actionBusy}
                    >
                      <option value="">Pilih tujuan</option>
                      {actionDestinationOptions.map((location) => (
                        <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                      ))}
                    </select>
                    {actionDestinationOptions.length === 0 && <small>Tidak ada tujuan aktif untuk organisasi SPPG ini.</small>}
                  </label>
                )}

                {editAction && (
                  <label className="trip-modal-field">
                    <span>Alasan perubahan</span>
                    <textarea
                      value={editReason}
                      onChange={(event) => setEditReason(event.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Contoh: kendaraan pengganti dibutuhkan karena unit sebelumnya masuk perawatan"
                    />
                    <small>{editReason.trim().length}/2000 · minimal 3 karakter</small>
                  </label>
                )}

                {pendingAction === "cancel" && (
                  <label className="trip-modal-field">
                    <span>Alasan pembatalan</span>
                    <textarea
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="Contoh: kendaraan rusak dan tidak ada pengganti"
                      autoFocus
                    />
                    <small>{cancelReason.trim().length}/2000 · minimal 3 karakter</small>
                  </label>
                )}
              </>
            )}

            {actionError && (
              <div className="trip-modal-error" role="alert">
                <AlertTriangle size={14} />
                <span>{actionError}</span>
              </div>
            )}

            <div className="trip-modal-actions">
              <button className="trip-action-button muted" onClick={closeAction} disabled={actionBusy}>Kembali</button>
              <button
                className={`trip-action-button ${pendingAction === "cancel" ? "danger" : "primary"}`}
                onClick={submitAction}
                disabled={
                  actionBusy ||
                  (needsActionOptions && actionOptionsState !== "ready") ||
                  missingEditFields ||
                  (pendingAction === "cancel" && cancelReason.trim().length < 3) ||
                  (editAction && editReason.trim().length < 3)
                }
              >
                {actionBusy
                  ? "Memproses..."
                  : pendingAction === "schedule"
                    ? "Jadwalkan trip"
                    : pendingAction === "ready"
                      ? "Tandai siap"
                      : pendingAction === "reschedule"
                        ? "Simpan jadwal"
                        : pendingAction === "reassign"
                          ? "Simpan armada"
                          : pendingAction === "destination"
                            ? "Simpan tujuan"
                            : "Batalkan trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryAction && deliveryModalCopy && (
        <div
          className="trip-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeliveryAction();
          }}
        >
          <div className="trip-modal trip-action-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-action-title">
            <button className="trip-modal-close" onClick={closeDeliveryAction} disabled={deliveryBusy} aria-label="Tutup dialog">
              <X size={17} />
            </button>
            <span className={`trip-modal-icon ${deliveryAction === "review-reject" ? "danger" : "primary"}`}>
              {deliveryAction === "start"
                ? <PackageCheck size={19} />
                : deliveryAction === "pod"
                  ? <FileText size={19} />
                  : deliveryAction === "review-accept"
                    ? <CheckCircle2 size={19} />
                    : deliveryAction === "review-reject"
                      ? <X size={19} />
                      : <ShieldCheck size={19} />}
            </span>
            <h2 id="delivery-action-title">{deliveryModalCopy.title}</h2>
            <p>{deliveryModalCopy.description}</p>

            {deliveryAction === "pod" ? (
              <>
                <div className="trip-delivery-summary">
                  <div><span>Dikirim</span><strong>{modalDispatched ?? "-"}</strong></div>
                  <div><span>POD versi</span><strong>{(currentRecord?.version ?? 0) + 1}</strong></div>
                  <div><span>Status</span><strong>{podRejected ? "Koreksi" : "POD baru"}</strong></div>
                </div>
                <div className="trip-form-grid">
                  <label className="trip-form-field" htmlFor="pod-received">
                    <span>Porsi diterima</span>
                    <input
                      id="pod-received"
                      type="number"
                      min={0}
                      max={100_000}
                      step={1}
                      value={podReceived}
                      onChange={(event) => setPodReceived(event.target.value)}
                      disabled={deliveryBusy}
                      autoFocus
                    />
                  </label>
                  <label className="trip-form-field" htmlFor="pod-damaged">
                    <span>Porsi rusak</span>
                    <input
                      id="pod-damaged"
                      type="number"
                      min={0}
                      max={100_000}
                      step={1}
                      value={podDamaged}
                      onChange={(event) => setPodDamaged(event.target.value)}
                      disabled={deliveryBusy}
                    />
                  </label>
                </div>
                <div className={podQuantityValid ? "trip-pod-calc" : "trip-pod-calc trip-pod-calc-error"}>
                  <span>Selisih otomatis</span>
                  <strong>
                    {podQuantityValid
                      ? podShortage === 0 && podDamagedValue === 0
                        ? "Tidak ada selisih"
                        : `${podShortage} kurang, ${podDamagedValue} rusak`
                      : "Jumlah tidak valid"}
                  </strong>
                </div>
                <label className="trip-modal-field">
                  <span>{podNeedsReason ? "Alasan selisih/koreksi" : "Alasan (opsional)"}</span>
                  <textarea
                    value={podReason}
                    onChange={(event) => setPodReason(event.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="Contoh: 4 porsi rusak saat bongkar muat"
                    disabled={deliveryBusy}
                  />
                  <small>
                    {podReason.trim().length}/2000
                    {podNeedsReason ? " - wajib, minimal 3 karakter" : " - opsional"}
                  </small>
                </label>
                <label className="trip-modal-field">
                  <span>Catatan serah-terima (opsional)</span>
                  <textarea
                    value={podNote}
                    onChange={(event) => setPodNote(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder="Nama penerima, kondisi kemasan, atau catatan lain"
                    disabled={deliveryBusy}
                  />
                </label>
              </>
            ) : deliveryAction === "review-accept" || deliveryAction === "review-reject" ? (
              <>
                <div className="trip-exception-summary">
                  <strong>POD versi {currentRecord?.version ?? 1}</strong>
                  <span>
                    Diterima {currentRecord?.receivedQuantity ?? 0} - rusak {currentRecord?.damagedQuantity ?? 0} - kurang {currentRecord?.shortageQuantity ?? 0}
                  </span>
                </div>
                <label className="trip-modal-field">
                  <span>Alasan review</span>
                  <textarea
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder={deliveryAction === "review-accept"
                      ? "Contoh: selisih sesuai berita acara dan bukti sudah lengkap"
                      : "Contoh: bukti rusak tidak sesuai laporan, mohon kirim koreksi"}
                    disabled={deliveryBusy}
                    autoFocus
                  />
                  <small>{reviewReason.trim().length}/2000 - minimal 3 karakter</small>
                </label>
              </>
            ) : (
              <div className="trip-delivery-summary">
                <div><span>Trip</span><strong>TRP-{trip.id.slice(0, 8).toUpperCase()}</strong></div>
                <div><span>Status</span><strong>{state.label}</strong></div>
                <div>
                  <span>{deliveryAction === "complete" ? "POD" : "Tujuan"}</span>
                  <strong>
                    {deliveryAction === "complete"
                      ? currentRecord ? `Versi ${currentRecord.version}` : "Belum ada"
                      : trip.deliveryLocation.name}
                  </strong>
                </div>
              </div>
            )}

            {deliveryError && (
              <div className="trip-modal-error" role="alert">
                <AlertTriangle size={14} />
                <span>{deliveryError}</span>
              </div>
            )}

            <div className="trip-modal-actions">
              <button className="trip-action-button muted" onClick={closeDeliveryAction} disabled={deliveryBusy}>
                Kembali
              </button>
              <button
                className={`trip-action-button ${deliveryAction === "review-reject" ? "danger" : "primary"}`}
                onClick={submitDeliveryAction}
                disabled={
                  deliveryBusy ||
                  (deliveryAction === "pod" && (!podQuantityValid || (podNeedsReason && podReason.trim().length < 3))) ||
                  ((deliveryAction === "review-accept" || deliveryAction === "review-reject") && reviewReason.trim().length < 3)
                }
              >
                {deliveryBusy
                  ? "Memproses..."
                  : deliveryAction === "start"
                    ? "Mulai serah-terima"
                    : deliveryAction === "pod"
                      ? podRejected ? "Kirim koreksi" : "Submit POD"
                      : deliveryAction === "review-accept"
                        ? "Terima POD"
                        : deliveryAction === "review-reject"
                          ? "Tolak POD"
                          : "Selesaikan trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {exceptionTarget && (
        <div
          className="trip-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeExceptionAction();
          }}
        >
          <div className="trip-modal trip-exception-modal" role="dialog" aria-modal="true" aria-labelledby="exception-action-title">
            <button className="trip-modal-close" onClick={closeExceptionAction} disabled={exceptionBusy} aria-label="Tutup dialog">
              <X size={17} />
            </button>
            <span className="trip-modal-icon primary">
              {exceptionAction === "triage"
                ? <AlertTriangle size={19} />
                : exceptionAction === "assign"
                  ? <UserRound size={19} />
                  : exceptionAction === "investigate"
                    ? <Search size={19} />
                    : exceptionAction === "resolve"
                      ? <CheckCircle2 size={19} />
                      : exceptionAction === "close"
                        ? <ShieldCheck size={19} />
                        : <ArrowRight size={19} />}
            </span>
            <h2 id="exception-action-title">{exceptionActionCopy.title}</h2>
            <p>{exceptionActionCopy.description}</p>

            <div className="trip-exception-summary">
              <strong>{exceptionTarget.title}</strong>
              <span>
                {labelOf(exceptionStatusLabels, exceptionTarget.status)} · {exceptionTarget.sppg.name}
              </span>
            </div>

            <label className="trip-form-field" htmlFor="exception-action">
              <span>Tindakan</span>
              <select
                id="exception-action"
                value={exceptionAction}
                onChange={(event) => {
                  setExceptionAction(event.target.value as ExceptionAction);
                  setExceptionError("");
                }}
                disabled={exceptionBusy}
              >
                {exceptionActionOptions.map((action) => (
                  <option key={action} value={action}>{exceptionActionLabels[action]}</option>
                ))}
              </select>
            </label>

            {exceptionAction === "triage" && (
              <label className="trip-form-field" htmlFor="exception-severity">
                <span>Tingkat keparahan</span>
                <select
                  id="exception-severity"
                  value={exceptionSeverity}
                  onChange={(event) => setExceptionSeverity(event.target.value as ExceptionSummary["severity"])}
                  disabled={exceptionBusy}
                >
                  <option value="ATTENTION">Perhatian</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="CRITICAL">Kritis</option>
                </select>
              </label>
            )}

            {exceptionAction === "assign" && (
              <div className="trip-exception-assignee">
                <UserRound size={15} />
                <div>
                  <span>Penerima tugas</span>
                  <strong>{sessionUser?.displayName ?? "Pengguna aktif"}</strong>
                </div>
              </div>
            )}

            {exceptionAction === "resolve" && (
              <label className="trip-modal-field">
                <span>Catatan resolusi</span>
                <textarea
                  value={exceptionResolution}
                  onChange={(event) => setExceptionResolution(event.target.value)}
                  maxLength={4000}
                  rows={3}
                  placeholder="Jelaskan tindakan yang menyelesaikan masalah"
                  disabled={exceptionBusy}
                />
                <small>{exceptionResolution.trim().length}/4000 · minimal 3 karakter</small>
              </label>
            )}

            {exceptionAction === "close" && (
              <label className="trip-form-field" htmlFor="exception-outcome">
                <span>Outcome penutupan</span>
                <select
                  id="exception-outcome"
                  value={exceptionOutcome}
                  onChange={(event) => setExceptionOutcome(event.target.value as ExceptionCloseOutcome)}
                  disabled={exceptionBusy}
                >
                  {(Object.keys(exceptionOutcomeLabels) as ExceptionCloseOutcome[]).map((outcome) => (
                    <option key={outcome} value={outcome}>{exceptionOutcomeLabels[outcome]}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="trip-modal-field">
              <span>Alasan tindakan</span>
              <textarea
                value={exceptionReason}
                onChange={(event) => setExceptionReason(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Contoh: data GPS menunjukkan sinyal terlambat lebih dari 30 menit"
                disabled={exceptionBusy}
              />
              <small>{exceptionReason.trim().length}/2000 · minimal 3 karakter</small>
            </label>

            {exceptionAction !== "resolve" && (
              <label className="trip-modal-field">
                <span>
                  Catatan tambahan
                  {exceptionAction === "close" && exceptionOutcome === "CLOSED_WITH_NOTE" ? " (wajib)" : " (opsional)"}
                </span>
                <textarea
                  value={exceptionNote}
                  onChange={(event) => setExceptionNote(event.target.value)}
                  maxLength={4000}
                  rows={2}
                  placeholder="Konteks tambahan untuk penelusuran"
                  disabled={exceptionBusy}
                />
                <small>{exceptionNote.trim().length}/4000</small>
              </label>
            )}

            {exceptionError && (
              <div className="trip-modal-error" role="alert">
                <AlertTriangle size={14} />
                <span>{exceptionError}</span>
              </div>
            )}

            <div className="trip-modal-actions">
              <button className="trip-action-button muted" onClick={closeExceptionAction} disabled={exceptionBusy}>Kembali</button>
              <button
                className="trip-action-button primary"
                onClick={submitExceptionAction}
                disabled={
                  exceptionBusy ||
                  exceptionReason.trim().length < 3 ||
                  (exceptionNote.trim().length > 0 && exceptionNote.trim().length < 3) ||
                  (exceptionAction === "resolve" && exceptionResolution.trim().length < 3) ||
                  (
                    exceptionAction === "close" &&
                    exceptionOutcome === "CLOSED_WITH_NOTE" &&
                    exceptionNote.trim().length < 3
                  )
                }
              >
                {exceptionBusy ? "Memproses..." : exceptionActionLabels[exceptionAction]}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function TripDetailPage() {
  return (
    <Suspense fallback={<div className="session-state"><span className="session-spinner" /><p>Memuat detail perjalanan...</p></div>}>
      <TripDetailContent />
    </Suspense>
  );
}
