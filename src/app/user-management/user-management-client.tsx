"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Users } from "lucide-react";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";
import { UsersManagementPanel } from "@/components/user-management-users-panel";
import { ApprovalsManagementPanel } from "@/components/user-management-approvals-panel";

type Tab = "accounts" | "approvals";

export default function UserManagementClient({ initialTab }: { initialTab: Tab }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState("");

  useEffect(() => {
    function syncTabFromUrl() {
      const currentTab = new URLSearchParams(window.location.search).get("tab");
      if (currentTab === "accounts" || currentTab === "approvals") setTab(currentTab);
    }
    window.addEventListener("popstate", syncTabFromUrl);
    let active = true;
    void getCurrentSession().then((current) => {
      if (active) setUser(current);
    }).catch((sessionError: unknown) => {
      if (!active) return;
      if (sessionError instanceof Error && sessionError.message === "UNAUTHENTICATED") {
        router.replace("/login?expired=1");
      } else {
        setError("Sesi tidak dapat diverifikasi. Periksa koneksi lalu coba lagi.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      window.removeEventListener("popstate", syncTabFromUrl);
    };
  }, [router]);

  if (loading) return <main className="session-state"><span className="session-spinner" /><p>Memuat Manajemen Pengguna…</p></main>;
  if (!user) return <main className="session-state"><span className="session-error-mark">!</span><h1>Layanan belum tersedia</h1><p>{error || "Sesi tidak dapat diverifikasi."}</p><Link className="session-retry" href="/login">Masuk</Link></main>;

  const canManageAccounts = hasPermission(user, "admin:manage_users");
  const canReview = hasPermission(user, "approval:review");
  const canRequest = hasPermission(user, "sppg:manage");
  const canAccessApprovals = canReview || canRequest;
  const selectedTab: Tab = !canManageAccounts || (tab === "approvals" && canAccessApprovals) ? "approvals" : "accounts";

  if (!canManageAccounts && !canAccessApprovals) {
    return <main className="session-state"><span className="session-error-mark">!</span><h1>Akses terbatas</h1><p>Peran Anda tidak memiliki izin untuk mengelola akun atau persetujuan.</p><Link className="session-retry" href="/">Kembali ke dashboard</Link></main>;
  }

  function selectTab(next: Tab) {
    setTab(next);
    window.history.pushState(null, "", `/user-management?tab=${next}`);
  }

  return (
    <>
      <nav className="user-management-tabs" aria-label="Bagian Manajemen Pengguna">
        {canManageAccounts && (
          <button className={`user-management-tab${selectedTab === "accounts" ? " active" : ""}`} onClick={() => selectTab("accounts")} type="button" aria-current={selectedTab === "accounts" ? "page" : undefined}>
            <Users size={16} /> Akun
          </button>
        )}
        {canAccessApprovals && (
          <button className={`user-management-tab${selectedTab === "approvals" ? " active" : ""}`} onClick={() => selectTab("approvals")} type="button" aria-current={selectedTab === "approvals" ? "page" : undefined}>
            <ClipboardCheck size={16} /> Persetujuan
          </button>
        )}
      </nav>
      {canManageAccounts && <div hidden={selectedTab !== "accounts"}><UsersManagementPanel /></div>}
      {canAccessApprovals && <div hidden={selectedTab !== "approvals"}><ApprovalsManagementPanel isVisible={selectedTab === "approvals"} /></div>}
    </>
  );
}
