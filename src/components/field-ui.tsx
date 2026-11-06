"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Bell, ClipboardList, History, Home, Info, LogOut, MapPin, Navigation, Package, RefreshCw, TriangleAlert, UserRound, WifiOff } from "lucide-react";
import { statusMeta, type StatusTone, formatDateTime } from "@/lib/field-status";
import type { GpsPermission } from "@/lib/use-trip-tracking";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Status selalu berupa ikon + teks, bukan warna saja. */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  const meta = statusMeta(status);
  return (
    <span className="field-badge" data-tone={meta.tone}>
      <span aria-hidden="true">{meta.icon}</span>
      {label ?? meta.label}
    </span>
  );
}

export function Banner({
  tone,
  title,
  children,
  action,
  icon,
}: {
  tone: StatusTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="field-banner" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      {icon ?? (tone === "info" || tone === "neutral" ? <Info size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />)}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <strong>{title}</strong>}
        {children}
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Online / sinkronisasi
// ---------------------------------------------------------------------------

export function OfflineSyncBanner({
  online,
  lastSync,
  pending = 0,
}: {
  online: boolean;
  lastSync: number | null;
  pending?: number;
}) {
  if (online && pending === 0) return null;
  return (
    <Banner
      tone={online ? "info" : "warning"}
      icon={<WifiOff size={18} aria-hidden="true" />}
      title={online ? "Menyinkronkan data" : "Anda sedang offline"}
    >
      {online
        ? `${pending} data lokasi menunggu sinkronisasi.`
        : `Data yang tampil adalah data lama. Terakhir sinkron: ${lastSync ? formatDateTime(lastSync) : "belum pernah"}.${
            pending > 0 ? ` ${pending} data lokasi menunggu sinkronisasi.` : ""
          }`}
    </Banner>
  );
}

// ---------------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------------

export function LocationPermissionBanner({
  permission,
  onRequest,
  busy,
}: {
  permission: GpsPermission;
  onRequest?: () => void;
  busy?: boolean;
}) {
  if (permission === "granted" || permission === "unknown") return null;
  if (permission === "unsupported") {
    return (
      <Banner tone="danger" title="GPS tidak didukung">
        Perangkat atau browser ini tidak mendukung lokasi. Perjalanan tidak dapat dimulai dari perangkat ini.
      </Banner>
    );
  }
  if (permission === "denied" || permission === "revoked") {
    return (
      <Banner tone="danger" title={permission === "revoked" ? "Izin lokasi dicabut" : "Izin lokasi ditolak"}>
        Lokasi hanya dikirim selama perjalanan aktif agar pengiriman dapat dipantau. Aktifkan izin lokasi untuk RADAR MBG di
        pengaturan browser atau perangkat Anda (Pengaturan situs → Lokasi → Izinkan), lalu muat ulang halaman.
      </Banner>
    );
  }
  return (
    <Banner
      tone="info"
      title="Izin lokasi diperlukan"
      action={
        onRequest ? (
          <button type="button" className="field-btn" data-variant="primary" onClick={onRequest} disabled={busy}>
            <MapPin size={16} aria-hidden="true" /> {busy ? "Meminta izin..." : "Izinkan lokasi"}
          </button>
        ) : null
      }
    >
      Lokasi perangkat dikirim hanya selama perjalanan aktif, untuk memantau posisi kendaraan dan mendeteksi kedatangan. Lokasi
      tidak dilacak di luar tugas.
    </Banner>
  );
}

export function GpsTrackingIndicator({
  tracking,
  stale,
  poorAccuracy,
  accuracy,
  lastSentAt,
  lastFixAt,
  online,
  pending,
  watchError,
}: {
  tracking: boolean;
  stale: boolean;
  poorAccuracy: boolean;
  accuracy: number | null;
  lastSentAt: number | null;
  lastFixAt: number | null;
  online: boolean;
  pending: number;
  watchError: string | null;
}) {
  if (watchError) {
    return (
      <Banner tone="danger" title="GPS tidak tersedia">
        Posisi perangkat tidak dapat dibaca. Pastikan GPS aktif dan Anda berada di area terbuka. Lokasi tidak sedang terkirim.
      </Banner>
    );
  }
  if (!tracking) return null;
  const sentLabel = lastSentAt ? formatDateTime(lastSentAt) : lastFixAt ? `${formatDateTime(lastFixAt)} (belum terkirim)` : "menunggu sinyal GPS";
  return (
    <Banner
      tone={stale ? "warning" : "success"}
      icon={<MapPin size={18} aria-hidden="true" />}
      title={stale ? "Data lokasi tidak terbaru" : "Pelacakan lokasi aktif"}
    >
      <div>Update terakhir: {sentLabel}</div>
      <div>
        Koneksi: {online ? "online" : "offline"}
        {pending > 0 ? ` · ${pending} menunggu sinkronisasi` : ""}
        {accuracy !== null ? ` · akurasi ±${Math.round(accuracy)} m` : ""}
      </div>
      {poorAccuracy && <div>Akurasi rendah. Pindah ke area terbuka agar lokasi lebih tepat.</div>}
    </Banner>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function FieldAppHeader({
  title,
  subtitle,
  name,
  onLogout,
}: {
  title: string;
  subtitle?: string;
  name?: string;
  onLogout?: () => void;
}) {
  const initials = (name ?? "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <header className="field-topbar">
      <div className="field-topbar-brand">
        <span className="field-avatar" aria-hidden="true">{initials}</span>
        <div style={{ minWidth: 0 }}>
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
      </div>
      {onLogout && (
        <button type="button" className="field-icon-btn" onClick={onLogout} aria-label="Keluar">
          <LogOut size={20} aria-hidden="true" />
        </button>
      )}
    </header>
  );
}

export type NavItem = { href: string; label: string; key: string; badge?: number };

const NAV_ICONS: Record<string, typeof Home> = {
  home: Home,
  tasks: ClipboardList,
  deliveries: Package,
  notifications: Bell,
  history: History,
  navigasi: Navigation,
  profile: UserRound,
};

export function BottomNavigation({ items, current, label }: { items: NavItem[]; current: string; label: string }) {
  return (
    <nav className="field-nav" aria-label={label}>
      {items.map((item) => {
        const Icon = NAV_ICONS[item.key] ?? Home;
        return (
          <Link key={item.key} href={item.href} className="field-nav-item" aria-current={current === item.key ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            <span>{item.label}</span>
            {item.badge ? <span className="field-nav-badge" aria-label={`${item.badge} belum dibaca`}>{item.badge > 9 ? "9+" : item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty / error
// ---------------------------------------------------------------------------

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="field-skeleton" role="status" aria-label="Memuat data">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="field-state field-card">
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "Data gagal dimuat" }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div className="field-state field-card" role="alert">
      <TriangleAlert size={28} color="#a41919" aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="field-btn" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" /> Coba Lagi
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog konfirmasi (keyboard & screen reader friendly)
// ---------------------------------------------------------------------------

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled):not([readonly]), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Dialog dasar Field App: fokus dipindah ke dalam dialog, Tab dikurung di dalam,
 * Escape menutup, dan fokus dikembalikan ke pemicu saat ditutup.
 *
 * `onClose` dan `dismissable` disimpan di ref supaya efek fokus hanya berjalan sekali
 * saat dialog dibuka. Sebelumnya efek bergantung pada `onClose` (fungsi inline baru di
 * setiap render), sehingga fokus dikembalikan ke elemen pertama setiap kali pengguna
 * mengetik di form dalam dialog.
 */
export function FieldDialog({
  labelledBy,
  onClose,
  dismissable = true,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  /** false: Escape dan klik latar tidak menutup dialog (mis. saat mengirim data). */
  dismissable?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissableRef.current = dismissable;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const initial = root?.querySelector<HTMLElement>(FOCUSABLE);
    (initial ?? root)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissableRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="field-overlay" onClick={() => dismissableRef.current && onCloseRef.current()}>
      <div
        ref={dialogRef}
        className="field-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmActionSheet({
  title,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  busy,
  tone = "primary",
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <FieldDialog labelledBy="field-dialog-title" onClose={onClose} dismissable={!busy}>
      <h2 id="field-dialog-title">{title}</h2>
      {description && <p className="field-caption" style={{ margin: "0 0 12px" }}>{description}</p>}
      {children}
      <div className="field-actions" style={{ marginTop: 14 }}>
        <button type="button" className="field-btn" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="field-btn" data-variant={tone} onClick={onConfirm} disabled={busy}>
          {busy ? "Memproses..." : confirmLabel}
        </button>
      </div>
    </FieldDialog>
  );
}
