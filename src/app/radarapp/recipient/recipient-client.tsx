"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";
import {
  ISSUE_CATEGORIES,
  clearFieldCaches,
  isApiUnavailable,
  logoutField,
  recipientApi,
  resolveWorkspaces,
  WORKSPACE_HOME,
  type RecipientDelivery,
  type RecipientMe,
  type RecipientNotification,
  type RecipientPod,
} from "@/lib/field-api";
import { getSelectedTenantId, setSelectedTenantId, type SessionUser } from "@/lib/api";
import { formatDateTime, safeErrorMessage } from "@/lib/field-status";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  Banner,
  BottomNavigation,
  ConfirmActionSheet,
  EmptyState,
  ErrorState,
  FieldAppHeader,
  FieldDialog,
  LoadingSkeleton,
  OfflineSyncBanner,
  StatusBadge,
  type NavItem,
} from "@/components/field-ui";

type Tab = "home" | "deliveries" | "notifications" | "profile";
type Filter = "today" | "upcoming" | "in_transit" | "awaiting" | "done" | "issue";
type LoadState = "loading" | "ready" | "forbidden" | "unavailable" | "error";

const TABS: Tab[] = ["home", "deliveries", "notifications", "profile"];
const FILTERS: Array<[Filter, string]> = [
  ["today", "Hari Ini"],
  ["upcoming", "Akan Datang"],
  ["in_transit", "Dalam Perjalanan"],
  ["awaiting", "Menunggu Konfirmasi"],
  ["done", "Selesai"],
  ["issue", "Bermasalah"],
];

const jakartaDay = (value: string | number | Date) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

const IN_TRANSIT = new Set(["PENDING", "IN_PROGRESS", "IN_TRANSIT", "APPROACHING", "ARRIVAL_CANDIDATE", "ARRIVED", "ARRIVAL_DETECTED", "ARRIVAL_VERIFIED"]);
const AWAITING = new Set(["POD_SUBMITTED", "RECIPIENT_REVIEW", "DELIVERED"]);
const DONE = new Set(["CONFIRMED", "RECEIVED", "COMPLETED"]);
const ISSUE = new Set(["ISSUE_REPORTED", "EXCEPTION"]);

function matchFilter(d: RecipientDelivery, filter: Filter): boolean {
  const when = d.scheduledAt ?? d.eta ?? null;
  const today = jakartaDay(new Date());
  switch (filter) {
    case "today":
      return when ? jakartaDay(when) === today : IN_TRANSIT.has(d.status);
    case "upcoming":
      return when ? jakartaDay(when) > today : false;
    case "in_transit":
      return IN_TRANSIT.has(d.status);
    case "awaiting":
      return AWAITING.has(d.status);
    case "done":
      return DONE.has(d.status);
    case "issue":
      return ISSUE.has(d.status);
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  GEOFENCE_ENTERED: "Kendaraan memasuki area",
  POD_SUBMITTED: "POD dikirim",
  POD_REVIEW_NEEDED: "POD perlu diperiksa",
  RECEIPT_CONFIRMED: "Penerimaan dikonfirmasi",
  DELIVERY_ISSUE: "Pengiriman bermasalah",
  SCHEDULE_CHANGED: "Perubahan jadwal",
};

export default function RecipientClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const online = useOnlineStatus();
  const rawTab = searchParams.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "home";

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [me, setMe] = useState<RecipientMe | null>(null);
  const [deliveries, setDeliveries] = useState<RecipientDelivery[]>([]);
  const [notifications, setNotifications] = useState<RecipientNotification[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [notifError, setNotifError] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("today");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);

  const [selected, setSelected] = useState<RecipientDelivery | null>(null);
  const [pod, setPod] = useState<RecipientPod | null>(null);
  const [podState, setPodState] = useState<"idle" | "loading" | "error">("idle");
  const [action, setAction] = useState<"confirm" | "issue" | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewEmoji, setReviewEmoji] = useState("😊");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const actionKey = useRef<string | null>(null);

  const sessionExpired = useCallback(() => {
    clearFieldCaches();
    router.replace("/radarapp/login?expired=1");
  }, [router]);

  const load = useCallback(
    async (initial: boolean) => {
      try {
        if (initial) {
          const resolved = await resolveWorkspaces();
          if (!resolved.workspaces.includes("recipient")) {
            if (resolved.workspaces.includes("driver")) {
              router.replace(WORKSPACE_HOME.driver);
              return;
            }
            setUser(resolved.user);
            setLoadState("forbidden");
            return;
          }
          setUser(resolved.user);
          if (!getSelectedTenantId() && (resolved.user.tenantMemberships?.length ?? 0) === 1) {
            setSelectedTenantId(resolved.user.tenantMemberships![0].tenantId);
          }
          const meData = await recipientApi.me();
          setMe(meData);
          setPhotoUrl(meData.photoUrl ?? "");
        }
        // Server membatasi data pada recipient site milik membership pengguna.
        setDeliveries(await recipientApi.deliveries());
        try {
          setNotifications(await recipientApi.notifications());
          setNotifError(false);
        } catch (error) {
          if (error instanceof Error && error.message === "UNAUTHENTICATED") throw error;
          setNotifError(true);
        }
        try {
          setReviews(await recipientApi.reviews() as any[]);
        } catch {
          // ignore if reviews not available
        }
        setLastSync(Date.now());
        setLoadState("ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "UNAUTHENTICATED") {
          sessionExpired();
          return;
        }
        if (isApiUnavailable(error)) {
          if (initial) {
            setLoadState("unavailable");
          } else {
            setRefreshError("Pembaruan gagal. Data terakhir tetap ditampilkan.");
          }
          return;
        }
        if (initial) {
          setErrorText(safeErrorMessage(error));
          setLoadState("error");
        } else {
          setRefreshError("Pembaruan gagal. Data terakhir tetap ditampilkan.");
        }
      }
    },
    [router, sessionExpired],
  );

  useEffect(() => {
    void load(true);
    const interval = window.setInterval(() => void load(false), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const sites = useMemo(() => me?.sites ?? [], [me]);
  const activeSiteId = siteId ?? sites[0]?.id ?? null;
  // Server sudah membatasi data pada lokasi milik membership. Bila pengguna punya lebih dari
  // satu lokasi, pemilih lokasi hanya mempersempit tampilan; tidak pernah memperluas akses.
  const scoped = useMemo(
    () => (sites.length > 1 && activeSiteId ? deliveries.filter((d) => !d.siteId || d.siteId === activeSiteId) : deliveries),
    [deliveries, sites.length, activeSiteId],
  );

  const unread = notifications.filter((n) => !n.readAt).length;
  const visible = useMemo(() => scoped.filter((d) => matchFilter(d, filter)), [scoped, filter]);
  const awaiting = scoped.filter((d) => AWAITING.has(d.status));
  const todayDeliveries = scoped.filter((d) => matchFilter(d, "today"));
  const inTransit = scoped.filter((d) => IN_TRANSIT.has(d.status));
  // Pengiriman yang sudah tampil di "hari ini" tidak diulang pada daftar menunggu konfirmasi.
  const awaitingOther = awaiting.filter((d) => !todayDeliveries.some((t) => t.stopId === d.stopId));
  const recentDone = scoped.filter((d) => DONE.has(d.status) || ISSUE.has(d.status)).slice(0, 3);
  const activeMapDelivery = scoped.find((d) => IN_TRANSIT.has(d.status) && d.lastLatitude != null && d.lastLongitude != null) ?? null;
  const nextDelivery = useMemo(() => {
    const candidates = todayDeliveries
      .filter((d) => d.eta || d.scheduledAt)
      .sort((a, b) => new Date(a.eta ?? a.scheduledAt!).getTime() - new Date(b.eta ?? b.scheduledAt!).getTime());
    return candidates[0] ?? todayDeliveries[0] ?? null;
  }, [todayDeliveries]);

  async function openDelivery(d: RecipientDelivery) {
    setSelected(d);
    setPod(null);
    setPodState("loading");
    try {
      setPod(await recipientApi.pod(d.stopId));
      setPodState("idle");
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        sessionExpired();
        return;
      }
      // 404 pada POD = belum ada POD untuk stop ini; bukan kesalahan.
      setPodState(error instanceof Error && error.message === "REQUEST_FAILED_404" ? "idle" : "error");
    }
  }

  function startAction(kind: "confirm" | "issue") {
    actionKey.current = crypto.randomUUID();
    setFormError("");
    setCategory("");
    setDescription("");
    setAction(kind);
  }

  async function runAction() {
    if (!selected || !action || busy) return;
    if (action === "issue") {
      if (!category) return setFormError("Pilih kategori masalah.");
      if (description.trim().length < 5) return setFormError("Deskripsi masalah wajib diisi (minimal 5 karakter).");
    }
    setBusy(true);
    setFormError("");
    const key = actionKey.current ?? crypto.randomUUID();
    try {
      if (action === "confirm") {
        await recipientApi.confirm(selected.stopId, key);
        setNotice({ tone: "success", text: "Penerimaan dikonfirmasi." });
      } else {
        const result = await recipientApi.reportIssue(selected.stopId, { category, description: description.trim() }, key);
        setNotice({
          tone: "success",
          text: `Laporan masalah terkirim${result?.reference ? ` (referensi ${result.reference})` : ""}.`,
        });
      }
      setAction(null);
      setSelected(null);
      await load(false);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        sessionExpired();
        return;
      }
      setFormError(isApiUnavailable(error) ? "Fitur ini belum tersedia di server." : safeErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!selected) return;
    setReviewBusy(true);
    setReviewError("");
    setReviewSuccess("");
    try {
      await recipientApi.createReview(selected.stopId, {
        rating: reviewRating,
        emoji: reviewEmoji,
        comment: reviewComment.trim() || undefined,
      });
      setReviewSuccess("Review terkirim.");
      setReviewComment("");
      const list = await recipientApi.reviews();
      setReviews(Array.isArray(list) ? list : []);
    } catch (error) {
      setReviewError(isApiUnavailable(error) ? "Fitur review belum tersedia di server." : safeErrorMessage(error));
    } finally {
      setReviewBusy(false);
    }
  }

  async function openNotification(n: RecipientNotification) {
    if (!n.readAt) {
      try {
        await recipientApi.markRead(n.id);
        setNotifications((list) => list.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item)));
      } catch {
        // gagal menandai dibaca tidak menghalangi navigasi
      }
    }
    const target = deliveries.find((d) => d.stopId === n.stopId);
    if (target) void openDelivery(target);
    else router.replace("/radarapp/recipient?tab=deliveries");
  }

  async function doLogout() {
    await logoutField();
    router.replace("/radarapp/login");
  }

  async function savePhoto() {
    setPhotoSaving(true);
    try {
      const updated = await recipientApi.updateProfile({ photoUrl: photoUrl.trim() || null });
      setMe((prev) => (prev ? { ...prev, photoUrl: updated.photoUrl ?? null } : prev));
      setPhotoUrl(updated.photoUrl ?? "");
      setNotice({ tone: "success", text: "Foto profil diperbarui." });
    } catch (error) {
      setNotice({ tone: "danger", text: safeErrorMessage(error) });
    } finally {
      setPhotoSaving(false);
    }
  }

  const navItems: NavItem[] = [
    { key: "home", label: "Beranda", href: "/radarapp/recipient?tab=home" },
    { key: "deliveries", label: "Pengiriman", href: "/radarapp/recipient?tab=deliveries" },
    { key: "notifications", label: "Notifikasi", href: "/radarapp/recipient?tab=notifications", badge: unread },
    { key: "profile", label: "Profil", href: "/radarapp/recipient?tab=profile" },
  ];

  const siteName = sites.find((s) => s.id === activeSiteId)?.name ?? sites[0]?.name ?? "Lokasi penerima";

  if (loadState === "loading") {
    return (
      <main className="field-app">
        <FieldAppHeader title="RADAR MBG" subtitle="Penerima" />
        <div className="field-content"><LoadingSkeleton /></div>
      </main>
    );
  }

  if (loadState === "forbidden") {
    return (
      <main className="field-app">
        <FieldAppHeader title="RADAR MBG" subtitle="Penerima" name={user?.displayName} onLogout={() => void doLogout()} />
        <div className="field-content">
          <ErrorState
            title="Akses terbatas"
            message="Akun Anda belum terhubung ke lokasi penerima. Hubungi pengelola lokasi atau administrator platform."
          />
        </div>
      </main>
    );
  }

  if (loadState === "unavailable") {
    return (
      <main className="field-app">
        <FieldAppHeader title="RADAR MBG" subtitle="Penerima" name={user?.displayName} onLogout={() => void doLogout()} />
        <div className="field-content">
          <ErrorState
            title="Layanan penerima belum tersedia"
            message="Server belum menyediakan data pengiriman untuk penerima. Tidak ada data yang ditampilkan sampai layanan ini aktif."
            onRetry={() => { setLoadState("loading"); void load(true); }}
          />
        </div>
      </main>
    );
  }

  const renderDelivery = (d: RecipientDelivery) => (
    <article key={d.stopId} className="field-card field-stack" aria-label={`Pengiriman ${d.tripReference}`}>
      <div className="field-trip-head">
        <span className="field-trip-ref">{d.tripReference}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {nextDelivery?.stopId === d.stopId && <span className="field-badge" data-tone="info">Berikutnya</span>}
          <StatusBadge status={d.status} />
        </div>
      </div>
      <div className="field-meta">
        <strong>{d.sppgName ?? "SPPG"}</strong>
        {d.siteName && <span>{d.siteName}</span>}
        {(d.vehiclePlate || d.driverName) && <span>{[d.vehiclePlate, d.driverName].filter(Boolean).join(" · ")}</span>}
        <span>
          {d.eta ? `ETA ${formatDateTime(d.eta)}` : d.scheduledAt ? `Jadwal ${formatDateTime(d.scheduledAt)}` : "Jadwal belum tersedia"}
          {d.plannedQuantity != null ? ` · rencana ${d.plannedQuantity} porsi` : ""}
        </span>
      </div>
      <div className="field-actions">
        <button type="button" className="field-btn" onClick={() => void openDelivery(d)}>
          Lihat Detail
        </button>
      </div>
    </article>
  );

  const renderCompactDelivery = (d: RecipientDelivery) => (
    <article key={d.stopId} className="field-card" style={{ padding: 12 }} aria-label={`Riwayat ${d.tripReference}`}>
      <div className="field-trip-head">
        <span className="field-trip-ref">{d.tripReference}</span>
        <StatusBadge status={d.status} />
      </div>
      <div className="field-meta">
        <strong>{d.siteName ?? siteName}</strong>
        <span>{d.sppgName ?? "SPPG"} · {d.plannedQuantity ?? "-"} porsi</span>
        <span>{d.eta ? `ETA ${formatDateTime(d.eta)}` : d.scheduledAt ? `Jadwal ${formatDateTime(d.scheduledAt)}` : "Jadwal belum tersedia"}</span>
      </div>
      <div className="field-actions">
        <button type="button" className="field-btn field-btn-block" data-variant="ghost" onClick={() => void openDelivery(d)}>
          Lihat Detail
        </button>
      </div>
    </article>
  );

  const canReview = selected !== null && AWAITING.has(selected.status) && pod !== null;

  return (
    <main className="field-app">
      <FieldAppHeader title="RADAR MBG" subtitle={`Penerima · ${siteName}`} name={user?.displayName} onLogout={() => void doLogout()} />
      <div className="field-content">
        <OfflineSyncBanner online={online} lastSync={lastSync} />
        {refreshError && (
          <Banner tone="warning" title="Pembaruan gagal">
            {refreshError}
          </Banner>
        )}
        {loadState === "error" ? (
          <ErrorState message={errorText} onRetry={() => { setLoadState("loading"); void load(true); }} />
        ) : (
          <>
            {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

            {sites.length > 1 && (
              <label className="field-field">
                <span>Lokasi</span>
                <select value={activeSiteId ?? sites[0].id} onChange={(e) => setSiteId(e.target.value)}>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <small className="field-hint">Hanya lokasi yang terhubung dengan akun Anda yang tampil.</small>
              </label>
            )}

            {tab === "home" && (
              <>
                {unread > 0 && (
                  <button type="button" className="field-btn field-btn-block" data-variant="ghost" onClick={() => router.push("/radarapp/recipient?tab=notifications")}>
                    {unread} notifikasi baru
                  </button>
                )}
                <h1 className="field-page-title">{siteName}</h1>
                <section className="field-stats" aria-label="Ringkasan">
                  <div className="field-stat"><strong>{todayDeliveries.length}</strong><span>Hari ini</span></div>
                  <div className="field-stat"><strong>{inTransit.length}</strong><span>Menuju lokasi</span></div>
                  <div className="field-stat"><strong>{awaiting.length}</strong><span>Menunggu konfirmasi</span></div>
                </section>
                {activeMapDelivery && (
                  <section className="field-card field-stack" aria-label="Peta kendaraan menuju lokasi">
                    <h2 className="field-section-title">Kendaraan menuju lokasi</h2>
                    <p className="field-caption">
                      {activeMapDelivery.tripReference} · {activeMapDelivery.siteName ?? siteName}
                      {activeMapDelivery.lastLocationAt ? ` · diperbarui ${formatDateTime(activeMapDelivery.lastLocationAt)}` : ""}
                    </p>
                    <div className="field-map">
                      <div className="field-map-frame">
                        <iframe
                          title="Lokasi terakhir kendaraan"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeMapDelivery.lastLongitude! - 0.01},${activeMapDelivery.lastLatitude! - 0.01},${activeMapDelivery.lastLongitude! + 0.01},${activeMapDelivery.lastLatitude! + 0.01}&layer=mapnik&marker=${activeMapDelivery.lastLatitude},${activeMapDelivery.lastLongitude}`}
                          loading="lazy"
                        />
                      </div>
                      {activeMapDelivery.lastLatitude != null && activeMapDelivery.lastLongitude != null && (
                        <a
                          href={`https://www.google.com/maps?q=${activeMapDelivery.lastLatitude},${activeMapDelivery.lastLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="field-btn field-btn-block"
                          data-variant="ghost"
                        >
                          Buka di Google Maps
                        </a>
                      )}
                    </div>
                  </section>
                )}
                <h2 className="field-section-title">Pengiriman hari ini</h2>
                {todayDeliveries.length === 0 ? (
                  <EmptyState title="Belum ada pengiriman untuk lokasi ini." />
                ) : (
                  <div className="field-list">{todayDeliveries.map(renderDelivery)}</div>
                )}
                {awaitingOther.length > 0 && (
                  <>
                    <h2 className="field-section-title">Menunggu konfirmasi</h2>
                    <div className="field-list">{awaitingOther.map(renderDelivery)}</div>
                  </>
                )}
                {todayDeliveries.length > 0 && awaitingOther.length === 0 && (
                  <Banner tone="success">Semua pengiriman hari ini sudah dikonfirmasi.</Banner>
                )}
                {recentDone.length > 0 && (
                  <>
                    <h2 className="field-section-title">Riwayat terbaru</h2>
                    <div className="field-list">{recentDone.map(renderCompactDelivery)}</div>
                  </>
                )}
              </>
            )}

            {tab === "deliveries" && (
              <>
                <h1 className="field-page-title">Pengiriman</h1>
                <div className="field-tabs" role="group" aria-label="Filter pengiriman">
                  {FILTERS.map(([key, label]) => (
                    <button key={key} type="button" className="field-chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                      {label}
                    </button>
                  ))}
                </div>
                {visible.length === 0 ? (
                  <EmptyState title="Belum ada pengiriman untuk lokasi ini." description="Tidak ada pengiriman pada filter ini." />
                ) : (
                  <div className="field-list">{visible.map(renderDelivery)}</div>
                )}
              </>
            )}

            {tab === "notifications" && (
              <>
                <h1 className="field-page-title">Notifikasi</h1>
                {notifError ? (
                  <ErrorState title="Notifikasi gagal dimuat" message="Coba lagi beberapa saat." onRetry={() => void load(false)} />
                ) : notifications.length === 0 ? (
                  <EmptyState title="Belum ada notifikasi." />
                ) : (
                  <div className="field-stack">
                    {notifications.map((n) => (
                      <button key={n.id} type="button" className="field-notif" data-unread={!n.readAt} onClick={() => void openNotification(n)}>
                        <span className="field-notif-icon" aria-hidden="true"><Bell size={18} /></span>
                        <span>
                          <strong style={{ display: "block" }}>{n.title}</strong>
                          {n.body && <span className="field-caption">{n.body}</span>}
                          <span className="field-caption" style={{ display: "block", marginTop: 4 }}>
                            {CATEGORY_LABEL[n.category] ?? "Pemberitahuan"}
                            {n.tripReference ? ` · ${n.tripReference}` : ""} · {formatDateTime(n.createdAt)}
                          </span>
                        </span>
                        <span className="field-badge" data-tone={n.readAt ? "neutral" : "info"}>{n.readAt ? "Dibaca" : "Baru"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "profile" && (
              <section className="field-card field-stack">
                <h2 className="field-section-title">Profil</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {me?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.photoUrl} alt={me?.displayName ?? "Foto profil"} style={{ width: 64, height: 64, borderRadius: 32, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 32, background: "#EAF2FF", display: "grid", placeItems: "center", color: "#1677FF", fontWeight: 700 }}>
                      {(me?.displayName ?? user?.displayName ?? "P").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, display: "grid", gap: 6 }}>
                    <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="URL foto profil" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="field-btn" onClick={() => void savePhoto()} disabled={photoSaving}>
                        {photoSaving ? "Menyimpan..." : "Simpan Foto"}
                      </button>
                      <button type="button" className="field-btn" onClick={() => { setPhotoUrl(""); void savePhoto(); }} disabled={photoSaving}>
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
                <dl className="field-dl" style={{ marginTop: 10 }}>
                  <div><dt>Nama</dt><dd>{me?.displayName ?? user?.displayName ?? "-"}</dd></div>
                  <div><dt>Lokasi / organisasi</dt><dd>{sites.map((s) => s.name).join(", ") || "-"}</dd></div>
                  <div><dt>Peran</dt><dd>{me?.role ?? "Penerima"}</dd></div>
                  <div><dt>Status akun</dt><dd>Aktif</dd></div>
                </dl>

                <h3 className="field-section-title" style={{ margin: "14px 0 8px" }}>Riwayat review</h3>
                {reviews.length === 0 ? (
                  <EmptyState title="Belum ada review." />
                ) : (
                  <div className="field-stack">
                    {reviews.map((r: any) => (
                      <article key={r.id} className="field-card field-stack">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong>{r.rating} ★ {r.emoji ?? ""}</strong>
                          <span className="field-caption">{formatDateTime(r.createdAt)}</span>
                        </div>
                        {r.comment && <p style={{ margin: 0 }}>{r.comment}</p>}
                      </article>
                    ))}
                  </div>
                )}

                <button type="button" className="field-btn field-btn-block" onClick={() => void doLogout()}>Keluar</button>
              </section>
            )}
          </>
        )}
      </div>

      <BottomNavigation items={navItems} current={tab} label="Navigasi penerima" />

      {selected && !action && (
        <FieldDialog labelledBy="delivery-title" onClose={() => setSelected(null)}>
          <>
            <div className="field-trip-head">
              <div>
                <h2 id="delivery-title">{selected.tripReference}</h2>
                <p className="field-caption" style={{ margin: 0 }}>Detail pengiriman</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <section className="field-card field-stack" aria-label="Informasi pengiriman">
              <h3 className="field-section-title">Informasi pengiriman</h3>
              <dl className="field-dl">
                <div><dt>SPPG</dt><dd>{selected.sppgName ?? "-"}</dd></div>
                <div><dt>Lokasi penerima</dt><dd>{selected.siteName ?? siteName}</dd></div>
                <div><dt>Kendaraan / driver</dt><dd>{[selected.vehiclePlate, selected.driverName].filter(Boolean).join(" · ") || "-"}</dd></div>
                <div><dt>Estimasi tiba</dt><dd>{selected.eta ? formatDateTime(selected.eta) : selected.scheduledAt ? formatDateTime(selected.scheduledAt) : "Belum tersedia"}</dd></div>
                <div>
                  <dt>Geofence</dt>
                  <dd>{selected.arrivedAt ? `Kendaraan terdeteksi memasuki area · ${formatDateTime(selected.arrivedAt)}` : "Belum memasuki area"}</dd>
                </div>
                <div>
                  <dt>Lokasi kendaraan</dt>
                  <dd>
                    {selected.lastLocationAt ? `Lokasi terakhir diperbarui ${formatDateTime(selected.lastLocationAt)}` : "Lokasi belum tersedia"}
                    {selected.lastLatitude != null && selected.lastLongitude != null && (
                      <>
                        {" · "}
                        <a href={`https://www.google.com/maps?q=${selected.lastLatitude},${selected.lastLongitude}`} target="_blank" rel="noreferrer">
                          Buka di peta
                        </a>
                      </>
                    )}
                    {selected.lastLocationAccuracy != null && (
                      <span className="field-caption" style={{ display: "block", marginTop: 4 }}>
                        Akurasi ±{Math.round(selected.lastLocationAccuracy)} m
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {selected.lastLatitude != null && selected.lastLongitude != null && (
                <div className="field-map">
                  <div className="field-map-frame">
                    <iframe
                      title="Lokasi terakhir kendaraan"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${selected.lastLongitude - 0.01},${selected.lastLatitude - 0.01},${selected.lastLongitude + 0.01},${selected.lastLatitude + 0.01}&layer=mapnik&marker=${selected.lastLatitude},${selected.lastLongitude}`}
                      loading="lazy"
                    />
                  </div>
                  <p className="field-caption" style={{ margin: 0 }}>
                    Peta menunjukkan lokasi terakhir yang diterima server, bukan posisi real-time.
                  </p>
                </div>
              )}

              {selected.sppgLatitude != null && selected.sppgLongitude != null && selected.deliveryLatitude != null && selected.deliveryLongitude != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${selected.sppgLatitude},${selected.sppgLongitude}&destination=${selected.deliveryLatitude},${selected.deliveryLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="field-btn field-btn-block"
                >
                  Lihat rute di Google Maps
                </a>
              )}
            </section>

            {selected.arrivedAt && !pod && (
              <Banner tone="info">Deteksi area hanya indikator kedatangan, bukan konfirmasi barang diterima.</Banner>
            )}

            <section className="field-card field-stack" aria-label="Bukti serah terima">
              <h3 className="field-section-title">Bukti serah terima (POD)</h3>
              {podState === "loading" && <LoadingSkeleton count={1} />}
              {podState === "error" && <ErrorState message="POD tidak dapat dimuat." onRetry={() => void openDelivery(selected)} />}
              {podState === "idle" && !pod && <p className="field-caption">POD belum dikirim oleh Driver.</p>}
              {pod && (
                <div className="field-stack">
                  <dl className="field-dl">
                    <div><dt>Driver</dt><dd>{pod.driverName ?? selected.driverName ?? "-"}</dd></div>
                    <div><dt>Waktu submit</dt><dd>{formatDateTime(pod.submittedAt)}</dd></div>
                    <div><dt>Jumlah diserahkan</dt><dd>{pod.deliveredQuantity ?? "-"} porsi</dd></div>
                    <div><dt>Penerima di lokasi</dt><dd>{pod.receiverName ?? "-"}</dd></div>
                  </dl>
                  {pod.note && <p style={{ margin: 0 }}>Catatan Driver: {pod.note}</p>}
                  {pod.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="field-photo" src={pod.photoUrl} alt="Foto bukti serah terima dari Driver" />
                  )}
                </div>
              )}
            </section>

            <section className="field-card field-stack" aria-label="Beri review">
              <h3 className="field-section-title">Beri review</h3>
              <div className="field-rating" role="radiogroup" aria-label="Rating 1 sampai 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`field-rating-btn ${n <= reviewRating ? "is-active" : ""}`}
                    aria-pressed={reviewRating === n}
                    aria-label={`${n} bintang`}
                    onClick={() => setReviewRating(n)}
                  >
                    {n <= reviewRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <div className="field-emoji-row" role="group" aria-label="Pilih emoji">
                {["😊", "🙂", "😐", "😞", "😡"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`field-emoji-btn ${reviewEmoji === e ? "is-active" : ""}`}
                    aria-pressed={reviewEmoji === e}
                    onClick={() => setReviewEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="field-field">
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Komentar (opsional)" aria-label="Komentar review" />
              </div>
              {reviewError && <p className="field-caption" style={{ color: "#DC2626" }}>{reviewError}</p>}
              {reviewSuccess && <p className="field-caption" style={{ color: "#16A34A" }}>{reviewSuccess}</p>}
              <button type="button" className="field-btn field-btn-block" data-variant="primary" onClick={() => void submitReview()} disabled={reviewBusy || !online}>
                {reviewBusy ? "Mengirim..." : "Kirim Review"}
              </button>
            </section>

            <div className="field-actions" style={{ marginTop: 14 }}>
              <button type="button" className="field-btn" onClick={() => setSelected(null)}>Tutup</button>
              {canReview && (
                <>
                  <button type="button" className="field-btn" onClick={() => startAction("issue")} disabled={!online}>
                    Laporkan Masalah
                  </button>
                  <button type="button" className="field-btn" data-variant="primary" onClick={() => startAction("confirm")} disabled={!online}>
                    Konfirmasi Penerimaan
                  </button>
                </>
              )}
            </div>
          </>
        </FieldDialog>
      )}

      {selected && action === "confirm" && (
        <ConfirmActionSheet
          title="Konfirmasi penerimaan?"
          description="Anda menyatakan pengiriman ini telah diterima sesuai POD. Tindakan ini tercatat atas nama Anda dan tidak dapat diubah langsung."
          confirmLabel="Konfirmasi Penerimaan"
          busy={busy}
          onConfirm={() => void runAction()}
          onClose={() => setAction(null)}
        >
          {formError && <Banner tone="danger">{formError}</Banner>}
        </ConfirmActionSheet>
      )}

      {selected && action === "issue" && (
        <ConfirmActionSheet
          title="Laporkan masalah"
          description="Laporan ini tercatat dan diteruskan ke SPPG terkait."
          confirmLabel="Kirim Laporan"
          tone="danger"
          busy={busy}
          onConfirm={() => void runAction()}
          onClose={() => setAction(null)}
        >
          <div className="field-form">
            <label className="field-field">
              <span>Kategori</span>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setFormError(""); }} disabled={busy}>
                <option value="">Pilih kategori</option>
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="field-field">
              <span>Deskripsi masalah</span>
              <textarea value={description} onChange={(e) => { setDescription(e.target.value); setFormError(""); }} disabled={busy} />
            </label>
            {formError && <Banner tone="danger">{formError}</Banner>}
          </div>
        </ConfirmActionSheet>
      )}
    </main>
  );
}
