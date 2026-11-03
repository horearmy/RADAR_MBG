// Label status UI untuk Field App. Enum mentah backend tidak boleh tampil di UI.
// Memuat status trip backend aktual (DRAFT..EXCEPTION) dan status target di
// spesifikasi (ASSIGNED, ACCEPTED, ARRIVED, ...) supaya aman saat backend berevolusi.

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export type StatusMeta = { label: string; tone: StatusTone; icon: string };

const STATUS: Record<string, StatusMeta> = {
  // Backend trip (aktual)
  DRAFT: { label: "Draft", tone: "neutral", icon: "○" },
  SCHEDULED: { label: "Ditugaskan", tone: "info", icon: "◷" },
  READY_TO_DEPART: { label: "Siap Berangkat", tone: "info", icon: "▶" },
  IN_TRANSIT: { label: "Dalam Perjalanan", tone: "info", icon: "➤" },
  ARRIVAL_DETECTED: { label: "Memeriksa Kedatangan", tone: "warning", icon: "◎" },
  ARRIVAL_VERIFIED: { label: "Kendaraan Tiba di Area", tone: "success", icon: "✓" },
  DELIVERY_IN_PROGRESS: { label: "Serah Terima Berjalan", tone: "info", icon: "▣" },
  DELIVERED: { label: "POD Terkirim", tone: "warning", icon: "✉" },
  COMPLETED: { label: "Selesai", tone: "success", icon: "✓" },
  CANCELLED: { label: "Dibatalkan", tone: "danger", icon: "✕" },
  EXCEPTION: { label: "Ada Masalah", tone: "danger", icon: "!" },
  // Status target spesifikasi
  ASSIGNED: { label: "Ditugaskan", tone: "info", icon: "◷" },
  ACCEPTED: { label: "Diterima Driver", tone: "info", icon: "✓" },
  IN_PROGRESS: { label: "Dalam Perjalanan", tone: "info", icon: "➤" },
  ARRIVAL_CANDIDATE: { label: "Memeriksa Kedatangan", tone: "warning", icon: "◎" },
  ARRIVED: { label: "Kendaraan Tiba di Area", tone: "success", icon: "✓" },
  POD_SUBMITTED: { label: "POD Terkirim", tone: "warning", icon: "✉" },
  RECIPIENT_REVIEW: { label: "Menunggu Konfirmasi", tone: "warning", icon: "⏳" },
  RECEIVED: { label: "Diterima", tone: "success", icon: "✓" },
  ISSUE_REPORTED: { label: "Ada Masalah", tone: "danger", icon: "!" },
  SKIPPED: { label: "Titik Dilewati", tone: "neutral", icon: "↷" },
  // Review POD
  PENDING_REVIEW: { label: "Menunggu Konfirmasi", tone: "warning", icon: "⏳" },
  ACCEPTED_REVIEW: { label: "Diterima", tone: "success", icon: "✓" },
  REJECTED: { label: "Ada Masalah", tone: "danger", icon: "!" },
  UNDER_REVIEW: { label: "Sedang Ditinjau", tone: "warning", icon: "⏳" },
  // Status DeliveryStop (recipient)
  PENDING: { label: "Menunggu", tone: "neutral", icon: "○" },
  CONFIRMED: { label: "Dikonfirmasi", tone: "success", icon: "✓" },
};

export function statusMeta(status: string | null | undefined): StatusMeta {
  if (!status) return { label: "Status tidak diketahui", tone: "neutral", icon: "?" };
  return STATUS[status] ?? { label: "Status tidak diketahui", tone: "neutral", icon: "?" };
}

/** Trip yang masih berjalan dari sisi Driver (bukan riwayat). */
export const DRIVER_ACTIVE_STATUSES = new Set([
  "SCHEDULED",
  "READY_TO_DEPART",
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
  "DELIVERED",
]);

/** GPS hanya boleh aktif selama trip benar-benar berjalan. */
export const TRACKING_STATUSES = new Set([
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
]);

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sesi berakhir. Silakan masuk kembali.",
  API_NOT_CONFIGURED: "Layanan belum dikonfigurasi. Hubungi administrator.",
  CSRF_UNAVAILABLE: "Tidak dapat memverifikasi keamanan permintaan. Coba lagi.",
  REQUEST_FAILED_403: "Anda tidak memiliki izin untuk tindakan ini.",
  REQUEST_FAILED_404: "Data tidak ditemukan atau tidak dapat diakses.",
  REQUEST_FAILED_409: "Data telah berubah. Muat ulang lalu coba lagi.",
  REQUEST_FAILED_429: "Terlalu banyak permintaan. Tunggu sebentar.",
  ILLEGAL_TRIP_TRANSITION: "Status perjalanan belum memungkinkan tindakan ini.",
  VARIANCE_REASON_REQUIRED: "Alasan selisih jumlah wajib diisi.",
};

/** Pesan aman untuk pengguna; tidak pernah menampilkan stack trace/kode mentah. */
export function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (ERROR_MESSAGES[raw]) return ERROR_MESSAGES[raw];
  if (/^REQUEST_FAILED_5\d\d$/.test(raw)) return "Layanan sedang bermasalah. Coba lagi beberapa saat.";
  if (raw === "Failed to fetch" || raw === "NetworkError") return "Tidak dapat terhubung ke layanan. Periksa koneksi.";
  return "Terjadi kesalahan. Coba lagi.";
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export function tripReference(id: string): string {
  return `TRP-${id.slice(0, 8).toUpperCase()}`;
}
