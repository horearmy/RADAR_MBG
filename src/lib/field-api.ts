// Klien API Field App (Driver & Penerima).
//
// Aturan penting (lihat spesifikasi UI/UX & Implementation Spec):
// - Role/workspace ditentukan server. Client tidak pernah mengirim tenant_id,
//   driver_id, atau recipient_site_id sebagai dasar otorisasi.
// - Endpoint /recipient/* BELUM ada di backend saat ini. Pemanggilan dilakukan
//   apa adanya; bila server membalas 404/501 UI menampilkan "belum tersedia".
//   Tidak ada data tiruan.

import {
  apiBaseUrl,
  apiFetch,
  apiGet,
  apiMutate,
  getCurrentSession,
  hasPermission,
  type SessionUser,
} from "@/lib/api";

export type FieldWorkspace = "driver" | "recipient";

export const FIELD_STORAGE_PREFIX = "radar_field_";

export type ResolvedWorkspaces = {
  user: SessionUser;
  workspaces: FieldWorkspace[];
};

export const WORKSPACE_HOME: Record<FieldWorkspace, string> = {
  driver: "/radarapp/driver",
  recipient: "/radarapp/recipient",
};

export function isDriver(user: SessionUser): boolean {
  // Driver punya driverId atau membership tenant role TENANT_DRIVER dengan permission yang sesuai.
  // tenantRole top-level sering null, jadi membership juga harus diperiksa.
  const hasDriverRecord = Boolean(user.driverId);
  const hasDriverMembership = (user.tenantMemberships ?? []).some((membership) => membership.role === "TENANT_DRIVER");
  const hasDriverRole = (user.tenantRole === "TENANT_DRIVER" || hasDriverMembership) &&
    hasPermission(user, "trip:start") &&
    hasPermission(user, "trip:location:update");
  return hasDriverRecord || hasDriverRole;
}

/**
 * Kembalikan workspace yang diizinkan server. Kosong = akun tidak punya akses Field App.
 *
 * `skipRecipientProbeForDriver`: dipakai halaman Driver saat memuat ulang. Akun Driver tidak
 * perlu mengecek `/recipient/me` di setiap load (menghindari request 404 berulang selama API
 * penerima belum tersedia). Pengecekan penuh tetap dilakukan saat login untuk pemilih workspace.
 */
export async function resolveWorkspaces(
  options: { skipRecipientProbeForDriver?: boolean } = {},
): Promise<ResolvedWorkspaces> {
  const user = await getCurrentSession();
  const workspaces: FieldWorkspace[] = [];
  if (isDriver(user)) {
    workspaces.push("driver");
    if (options.skipRecipientProbeForDriver) return { user, workspaces };
  }
  try {
    await apiGet<unknown>("/recipient/me");
    workspaces.push("recipient");
  } catch (error) {
    // 401 berarti sesi bermasalah; selain itu (403/404/501) = bukan penerima / belum tersedia.
    if (error instanceof Error && error.message === "UNAUTHENTICATED") throw error;
  }
  return { user, workspaces };
}

export function clearFieldCaches() {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key && (key.startsWith(FIELD_STORAGE_PREFIX) || key.startsWith("pod_draft_"))) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    }
  } catch {
    // storage dapat diblokir; abaikan
  }
}

export async function logoutField(): Promise<void> {
  try {
    await apiMutate<void>("/auth/logout", "POST");
  } catch {
    // tetap bersihkan sisi client meski request gagal
  } finally {
    clearFieldCaches();
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("radar-mbg-data")).map((key) => caches.delete(key)));
      } catch {
        // abaikan
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Recipient API (kontrak konseptual; sesuaikan bila backend berbeda)
// ---------------------------------------------------------------------------

export type RecipientMe = {
  displayName?: string;
  photoUrl?: string | null;
  role?: string;
  sites?: Array<{ id: string; name: string; organizationName?: string }>;
};

export type RecipientDelivery = {
  stopId: string;
  /** Lokasi penerima milik stop ini; dipakai untuk pemilih lokasi bila pengguna punya beberapa membership. */
  siteId?: string | null;
  tripReference: string;
  sppgName?: string;
  siteName?: string;
  status: string;
  podStatus?: string | null;
  scheduledAt?: string | null;
  eta?: string | null;
  arrivedAt?: string | null;
  plannedQuantity?: number | null;
  deliveredQuantity?: number | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  sppgLatitude?: number | null;
  sppgLongitude?: number | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAt?: string | null;
  lastLocationAccuracy?: number | null;
};

export type RecipientPod = {
  stopId: string;
  tripReference: string;
  siteName?: string;
  sppgName?: string;
  driverName?: string;
  submittedAt?: string | null;
  deliveredQuantity?: number | null;
  receiverName?: string | null;
  note?: string | null;
  photoUrl?: string | null;
  status?: string | null;
};

export type RecipientNotification = {
  id: string;
  category: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt?: string | null;
  tripReference?: string | null;
  stopId?: string | null;
};

function toList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export const recipientApi = {
  me: () => apiGet<RecipientMe>("/recipient/me"),
  updateProfile: (input: { photoUrl?: string | null }) =>
    apiMutate<RecipientMe>("/recipient/profile", "PATCH", input),
  deliveries: async () => toList<RecipientDelivery>(await apiGet<unknown>("/recipient/deliveries")),
  stop: (stopId: string) => apiGet<RecipientDelivery>(`/recipient/stops/${encodeURIComponent(stopId)}`),
  pod: (stopId: string) => apiGet<RecipientPod>(`/recipient/stops/${encodeURIComponent(stopId)}/pod`),
  confirm: (stopId: string, idempotencyKey: string) =>
    apiMutate<unknown>(`/recipient/stops/${encodeURIComponent(stopId)}/confirm`, "POST", undefined, idempotencyKey),
  reportIssue: (stopId: string, input: { category: string; description: string }, idempotencyKey: string) =>
    apiMutate<{ reference?: string }>(
      `/recipient/stops/${encodeURIComponent(stopId)}/report-issue`,
      "POST",
      input,
      idempotencyKey,
    ),
  notifications: async () => toList<RecipientNotification>(await apiGet<unknown>("/recipient/notifications")),
  markRead: (id: string) =>
    apiMutate<unknown>(`/recipient/notifications/${encodeURIComponent(id)}/read`, "POST"),
  createReview: (stopId: string, input: { rating: number; emoji?: string; comment?: string }) =>
    apiMutate<unknown>(`/recipient/stops/${encodeURIComponent(stopId)}/review`, "POST", input),
  getReview: (stopId: string) => apiGet<unknown>(`/recipient/stops/${encodeURIComponent(stopId)}/review`),
  reviews: () => apiGet<unknown>("/recipient/reviews"),
  updateReview: (id: string, input: { rating?: number; emoji?: string; comment?: string }) =>
    apiMutate<unknown>(`/recipient/reviews/${encodeURIComponent(id)}`, "PATCH", input),
  deleteReview: async (id: string) => {
    const csrfRes = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
    const csrf = await csrfRes.json().catch(() => null);
    if (!csrfRes.ok || !csrf?.csrfToken) throw new Error("CSRF_UNAVAILABLE");
    const response = await apiFetch(`/recipient/reviews/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf.csrfToken },
    });
    if (!response.ok) throw new Error(`REQUEST_FAILED_${response.status}`);
    return response.json().catch(() => ({ ok: true }));
  },
};

/** 404/501 dari endpoint penerima berarti backend belum menyediakan API-nya. */
export function isApiUnavailable(error: unknown): boolean {
  return error instanceof Error && (error.message === "REQUEST_FAILED_404" || error.message === "REQUEST_FAILED_501");
}

export const ISSUE_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "QUANTITY_MISMATCH", label: "Jumlah tidak sesuai" },
  { value: "PACKAGING_DAMAGED", label: "Kemasan rusak" },
  { value: "QUALITY_MISMATCH", label: "Kualitas/kondisi tidak sesuai" },
  { value: "LATE", label: "Terlambat" },
  { value: "WRONG_LOCATION_OR_RECEIVER", label: "Lokasi/penerima tidak sesuai" },
  { value: "OTHER", label: "Lainnya" },
];

// ---------------------------------------------------------------------------
// DevTools API (development only)
// ---------------------------------------------------------------------------

export type DevTrip = {
  id: string;
  status: string;
  trackingStatus: string;
  verificationStatus: string;
  deliveryStatus: string;
  plannedQuantity: number;
  dispatchedQuantity: number | null;
  plannedDepartureAt: string;
  deliveryLocation: { name: string };
  driver: { name: string } | null;
};

export type DevTripStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "READY_TO_DEPART"
  | "IN_TRANSIT"
  | "ARRIVAL_DETECTED"
  | "ARRIVAL_VERIFIED"
  | "DELIVERY_IN_PROGRESS"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXCEPTION";

export const DEV_TRIP_STATUSES: DevTripStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "READY_TO_DEPART",
  "IN_TRANSIT",
  "ARRIVAL_DETECTED",
  "ARRIVAL_VERIFIED",
  "DELIVERY_IN_PROGRESS",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "EXCEPTION",
];

export const DEV_TRIP_STATUS_LABELS: Record<DevTripStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Ditugaskan",
  READY_TO_DEPART: "Siap Berangkat",
  IN_TRANSIT: "Dalam Perjalanan",
  ARRIVAL_DETECTED: "Memeriksa Kedatangan",
  ARRIVAL_VERIFIED: "Kendaraan Tiba",
  DELIVERY_IN_PROGRESS: "Serah Terima Berjalan",
  DELIVERED: "POD Terkirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  EXCEPTION: "Ada Masalah",
};

/** Cek apakah DevTools aktif (hanya di development). */
export function isDevToolsAvailable(): boolean {
  // NODE_ENV otomatis "development" saat `next dev` dan "production" saat build.
  return process.env.NODE_ENV === "development";
}

export async function getDevTrips(): Promise<DevTrip[]> {
  return toList<DevTrip>(await apiGet<unknown>("/dev/trips"));
}

export async function setDevTripStatus(
  tripId: string,
  status: DevTripStatus,
): Promise<{ ok: boolean; error?: string; previousStatus?: string }> {
  return apiMutate<{ ok: boolean; error?: string; previousStatus?: string }>(
    `/dev/trips/${encodeURIComponent(tripId)}/status`,
    "POST",
    { status },
  );
}

export { apiBaseUrl };
