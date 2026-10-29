"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { getCurrentSession, getSessionRole, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

const roleLabels: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Pengemudi",
  REVIEWER: "Peninjau",
  AUDITOR: "Auditor",
};

function roleLabel(user: SessionUser) {
  const code = user.roles[0]?.code;
  if (code && roleLabels[code]) return roleLabels[code];
  const raw = getSessionRole(user);
  return raw === "Pengguna" ? raw : raw.replaceAll("_", " ");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0] ?? "").join("").toUpperCase() || "RB";
}

export function AccountMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      const csrfResponse = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfToken) throw new Error("Token keamanan tidak tersedia");
      const response = await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!response.ok) throw new Error("Sesi belum berhasil diakhiri");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal keluar");
      setBusy(false);
    }
  }

  return (
    <div className="header-account" ref={rootRef}>
      <button
        type="button"
        className={open ? "header-account-trigger open" : "header-account-trigger"}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="header-account-avatar" aria-hidden="true">{initials(user.displayName)}</span>
        <span className="header-account-copy">
          <strong>{user.displayName}</strong>
          <span>{roleLabel(user)}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="header-account-menu" id={menuId} role="menu">
          <div className="header-account-sheet">
            <span className="header-account-avatar" aria-hidden="true">{initials(user.displayName)}</span>
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.username}</span>
            </div>
          </div>
          <p className="header-account-role">{roleLabel(user)} · {user.mfaEnabled ? "MFA aktif" : "MFA belum aktif"}</p>
          <Link href="/security/mfa" role="menuitem" onClick={() => setOpen(false)}>
            <ShieldCheck size={14} /> Keamanan akun
          </Link>
          {error && <p className="header-account-error">{error}</p>}
          <button type="button" role="menuitem" className="header-account-logout" onClick={logout} disabled={busy}>
            <LogOut size={14} /> {busy ? "Mengakhiri sesi…" : "Keluar"}
          </button>
        </div>
      )}
    </div>
  );
}

export function HeaderAccount({ user }: { user?: SessionUser | null }) {
  const pathname = usePathname();
  const [current, setCurrent] = useState<SessionUser | null>(user ?? null);

  useEffect(() => {
    if (user) {
      setCurrent(user);
      return;
    }
    if (pathname.startsWith("/login") || pathname.startsWith("/account-access")) return;
    let active = true;
    void getCurrentSession()
      .then((session) => {
        if (active) setCurrent(session);
      })
      .catch(() => {
        if (active) setCurrent(null);
      });
    return () => {
      active = false;
    };
  }, [pathname, user]);

  if (!current) return null;
  return <AccountMenu user={current} />;
}
