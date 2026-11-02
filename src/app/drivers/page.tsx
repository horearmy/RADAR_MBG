"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DriverCard } from "@/app/drivers/DriverCard";
import { BottomNavBar } from "@/app/drivers/BottomNavBar";
import { FilterChips } from "@/app/drivers/FilterChips";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";
import { hasFeature } from "@/app/drivers/user-features";
import type { UserFeatures } from "@/app/drivers/user-features";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

type DriverRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  region?: { name: string } | null;
  organization?: { name: string } | null;
  updatedAt: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";

export default function DriversPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Load drivers data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const session = await getCurrentSession().catch(() => null);
        if (session) setUser(session);
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        const res = await fetch(`${apiBase}/admin/drivers?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? "Gagal memuat Driver");
        setRows(json.data ?? []);
        // client-side filter
        const q = search.trim().toLowerCase();
        const filtered = rows.filter((row: DriverRow) => {
          if (statusFilter !== "ALL" && row.status?.toUpperCase() !== statusFilter) return false;
          if (!q) return true;
          return (
            row.code?.toLowerCase().includes(q) ||
            row.name?.toLowerCase().includes(q) ||
            (row.address?.toLowerCase().includes(q) ?? false) ||
            (row.region?.name?.toLowerCase().includes(q) ?? false) ||
            (row.organization?.name?.toLowerCase().includes(q) ?? false)
          );
        });
        setRows(filtered);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [page, rows, search, statusFilter]);

  // Compute stats from current rows (client-side)
  const stats = useMemo(() => {
    const total = rows.length;
    const aktif = rows.filter((r: DriverRow) => r.status?.toUpperCase() === "ACTIVE").length;
    const perhatian = rows.filter((r: DriverRow) => r.status?.toUpperCase() === "SUSPENDED").length;
    const nonaktif = rows.filter((r: DriverRow) => {
      const s = r.status?.toUpperCase();
      return s === "INACTIVE" || s === "ARCHIVED";
    }).length;
    return { total, aktif, perhatian, nonaktif };
  }, [rows]);

  // Permission checks
  const canManageUsers = user ? hasPermission(user, "admin:manage_users") : false;
  const canAccessGeofences = user ? hasPermission(user, "geofence:read") || hasPermission(user, "geofence:manage") : false;
  const canDrive = user ? hasPermission(user, "trip:start") && hasPermission(user, "trip:location:update") : false;

  return (
    <main className="app-shell">
      {/* Header / AppBar Material */}
      <header style={{
        height: 56,
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#1d2b40",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/"
            style={{
              display: "grid",
              placeItems: "center",
              color: "#62728A",
              fontSize: 20,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              style={{ marginRight: 8 }}
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Manajemen Driver
          </Link>
          <Link
            href="/drivers/new"
            style={{
              marginLeft: 16,
              display: "grid",
              placeItems: "center",
              color: "#1677FF",
              fontSize: 18,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            +
          </Link>
        </div>

        <FilterChips
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
      </header>

      <div style={{ padding: "20px 16px 40px" }}>
        {/* KPI Section */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}>
          <article style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            minHeight: 80,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 50, background: "#eaf2ff", display: "grid", placeItems: "center" }}>
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M17 21v5" />
                <path d="M21 17l-4-4-5-5" />
                <path d="M5 17v5h14" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#62728A", marginBottom: 4 }}>Total Driver</div>
              <div style={{ fontSize: 34, color: "#1d2b40", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {stats.total}
              </div>
              <div style={{ fontSize: 12, color: "#8693a3" }}>unit</div>
            </div>
          </article>

          <article style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            minHeight: 80,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 50, background: "#e8f4f0", display: "grid", placeItems: "center" }}>
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M17 21v5" />
                <path d="M21 17l-4-4-5-5" />
                <path d="M5 17v5h14" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#62728A", marginBottom: 4 }}>Aktif</div>
              <div style={{ fontSize: 34, color: "#1d2b40", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {stats.aktif}
              </div>
              <div style={{ fontSize: 12, color: "#8693a3" }}>beroperasi</div>
            </div>
          </article>

          <article style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            minHeight: 80,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 50, background: "#fffef7", display: "grid", placeItems: "center" }}>
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.94-3.17" />
                <path d="M22 4L12 4 5 11.08" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#62728A", marginBottom: 4 }}>Perhatian</div>
              <div style={{ fontSize: 34, color: "#1d2b40", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {stats.perhatian}
              </div>
              <div style={{ fontSize: 12, color: "#8693a3", marginTop: 1 }}>tindak lanjut</div>
            </div>
          </article>

          <article style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            minHeight: 80,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 50, background: "#fafafa", display: "grid", placeItems: "center" }}>
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#62728A", marginBottom: 4 }}>Nonaktif</div>
              <div style={{ fontSize: 34, color: "#1d2b40", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {stats.nonaktif}
              </div>
              <div style={{ fontSize: 12, color: "#8693a3" }}>tidak beroperasi</div>
            </div>
          </article>
        </section>

        {/* Table Area with DriverCards */}
        <section>
          {loading && (
            <div style={{
              minHeight: 200,
              background: "#f9fafb",
              borderRadius: 8,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#62728A",
              fontSize: 14,
            }}>
              Memuat data Driver...
            </div>
          )}

          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 16,
              color: "#b00020",
              fontSize: 14,
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div style={{
              textAlign: "center",
              padding: 40,
              color: "#62728A",
            }}>
              <svg
                width={80}
                height={80}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                style={{ marginTop: "0", marginBottom: "12" }}
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
              </svg>
              <div style={{ marginTop: 12, fontSize: 24, color: "#1d2b40" }}>Tidak ada Driver</div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#62728A" }}>
                Tambah driver pertama untuk memulai pelacakan
              </div>
              <br />
              <button
                style={{
                  marginTop: 16,
                  padding: "10px 24px",
                  background: "#1677FF",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "#1a7bff"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "#1677FF"; }}
              >
                Tambah Driver
              </button>
            </div>
          )}

          {hasFeature(user as any, "drivers") ? (
              <p>Driver actived</p>
            ) : (
              <p>Driver not actived</p>
            )}

          {!loading && !error && page > 1 && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "8px 0",
              color: "#62728A",
              fontSize: 12,
            }}>
              Halaman {page}
              <span style={{ margin: "0 8px" }}>/</span>
              {/* totalPages */}
            </div>
          )}
        </section>
      </div>

      <BottomNavBar onSectionChange={() => { }} hasFeature={(feature: string) => hasFeature(user as any, feature as "drivers" | "vehicles")} />
    </main>
  );
}