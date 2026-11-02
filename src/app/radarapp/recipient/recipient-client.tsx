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
import type { SessionUser } from "@/lib/api";
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

const IN_TRANSIT = new Set(["IN_PROGRESS", "IN_TRANSIT", "APPROACHING", "ARRIVAL_CANDIDATE", "ARRIVED", "ARRIVAL_DETECTED", "ARRIVAL_VERIFIED"]);
const AWAITING = new Set(["POD_SUBMITTED", "RECIPIENT_REVIEW", "DELIVERED"]);
const DONE = new Set(["RECEIVED", "COMPLETED"]);
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
  const [notifError, setNotifError] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");
  const [filter, setFilter] = useState<Filter>("today");
  const [siteId, setSiteId] = useState<string | null>(null);

  const [selected, setSelected] = useState<RecipientDelivery | null>(null);
  const [pod, setPod] = useState<RecipientPod | null>(null);
  const [podState, setPodState] = useState<"idle" | "loading" | "error">("idle");
  const [action, setAction] = useState<"confirm" | "issue" | null>(null);
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
          setMe(await recipientApi.me());
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
        setLastSync(Date.now());
        setLoadState("ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "UNAUTHENTICATED") {
          sessionExpired();
          return;
        }
        if (isApiUnavailable(error)) {
          setLoadState("unavailable");
          return;
        }
        if (initial) {
          setErrorText(safeErrorMessage(error));
          setLoadState("error");
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
        <StatusBadge status={d.status} />
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

  const canReview = selected !== null && AWAITING.has(selected.status) && pod !== null;

  return (
    <main className="field-app">
      <FieldAppHeader title="RADAR MBG" subtitle={`Penerima · ${siteName}`} name={user?.displayName} onLogout={() => void doLogout()} />
      <div className="field-content">
        <OfflineSyncBanner online={online} lastSync={lastSync} />
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
                <h1 className="field-page-title">{siteName}</h1>
                <section className="field-stats" aria-label="Ringkasan">
                  <div className="field-stat"><strong>{todayDeliveries.length}</strong><span>Hari ini</span></div>
                  <div className="field-stat"><strong>{inTransit.length}</strong><span>Menuju lokasi</span></div>
                  <div className="field-stat"><strong>{awaiting.length}</strong><span>Menunggu konfirmasi</span></div>
                </section>
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
                {recentDone.length > 0 && (
                  <>
                    <h2 className="field-section-title">Riwayat terbaru</h2>
                    <div className="field-list">{recentDone.map(renderDelivery)}</div>
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
                <dl className="field-dl">
                  <div><dt>Nama</dt><dd>{me?.displayName ?? user?.displayName ?? "-"}</dd></div>
                  <div><dt>Lokasi / organisasi</dt><dd>{sites.map((s) => s.name).join(", ") || "-"}</dd></div>
                  <div><dt>Peran</dt><dd>{me?.role ?? "Penerima"}</dd></div>
                  <div><dt>Status akun</dt><dd>Aktif</dd></div>
                </dl>
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
              <h2 id="delivery-title">{selected.tripReference}</h2>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="field-dl" style={{ marginTop: 10 }}>
              <div><dt>SPPG</dt><dd>{selected.sppgName ?? "-"}</dd></div>
              <div><dt>Lokasi</dt><dd>{selected.siteName ?? siteName}</dd></div>
              <div><dt>Kendaraan / driver</dt><dd>{[selected.vehiclePlate, selected.driverName].filter(Boolean).join(" · ") || "-"}</dd></div>
              <div><dt>Jadwal / ETA</dt><dd>{selected.eta ? formatDateTime(selected.eta) : selected.scheduledAt ? formatDateTime(selected.scheduledAt) : "Belum tersedia"}</dd></div>
              <div>
                <dt>Geofence</dt>
                <dd>
                  {selected.arrivedAt
                    ? `Kendaraan terdeteksi memasuki area · ${formatDateTime(selected.arrivedAt)}`
                    : "Belum memasuki area"}
                </dd>
              </div>
              <div>
                <dt>Lokasi kendaraan</dt>
                <dd>{selected.lastLocationAt ? `Lokasi terakhir diperbarui ${formatDateTime(selected.lastLocationAt)}` : "Lokasi belum tersedia"}</dd>
              </div>
            </dl>
            {selected.arrivedAt && !pod && (
              <Banner tone="info">Deteksi area hanya indikator kedatangan, bukan konfirmasi barang diterima.</Banner>
            )}

            <h3 className="field-section-title" style={{ margin: "14px 0 8px" }}>Bukti serah terima (POD)</h3>
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
