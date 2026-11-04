"use client";

import Link from "next/link";

type FilterChipsProps = {
  statusFilter: "ALL" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";
  onStatusChange: (status: "ALL" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "ARCHIVED") => void;
};

export function FilterChips({ statusFilter, onStatusChange }: FilterChipsProps) {
  const chipStyles = {
    ALL: {
      bg: statusFilter === "ALL" ? "#1677FF" : "transparent",
      color: statusFilter === "ALL" ? "#FFFFFF" : "#62728A",
      border: statusFilter === "ALL" ? "1px solid #1677FF" : "1px solid #dce4ef",
    },
    ACTIVE: {
      bg: statusFilter === "ACTIVE" ? "#16a765" : "transparent",
      color: statusFilter === "ACTIVE" ? "#FFFFFF" : "#62728A",
      border: statusFilter === "ACTIVE" ? "1px solid #16a765" : "1px solid #dce4ef",
    },
    SUSPENDED: {
      bg: statusFilter === "SUSPENDED" ? "#f59e0b" : "transparent",
      color: statusFilter === "SUSPENDED" ? "#FFFFFF" : "#62728A",
      border: statusFilter === "SUSPENDED" ? "1px solid #f59e0b" : "1px solid #dce4ef",
    },
    INACTIVE: {
      bg: statusFilter === "INACTIVE" ? "#6b7280" : "transparent",
      color: statusFilter === "INACTIVE" ? "#FFFFFF" : "#62728A",
      border: statusFilter === "INACTIVE" ? "1px solid #6b7280" : "1px solid #dce4ef",
    },
    ARCHIVED: {
      bg: statusFilter === "ARCHIVED" ? "#a3a3a3" : "transparent",
      color: statusFilter === "ARCHIVED" ? "#FFFFFF" : "#62728A",
      border: statusFilter === "ARCHIVED" ? "1px solid #a3a3a3" : "1px solid #dce4ef",
    },
  };

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      <button
        className="filter-chip"
        style={chipStyles.ALL}
        onClick={() => onStatusChange("ALL")}
        role="button"
        tabIndex={statusFilter === "ALL" ? 0 : -1}
      >
        Semua
      </button>
      <button
        className="filter-chip"
        style={chipStyles.ACTIVE}
        onClick={() => onStatusChange("ACTIVE")}
        role="button"
        tabIndex={statusFilter === "ACTIVE" ? 0 : -1}
      >
        Aktif
      </button>
      <button
        className="filter-chip"
        style={chipStyles.SUSPENDED}
        onClick={() => onStatusChange("SUSPENDED")}
        role="button"
        tabIndex={statusFilter === "SUSPENDED" ? 0 : -1}
      >
        Perhatian
      </button>
      <button
        className="filter-chip"
        style={chipStyles.INACTIVE}
        onClick={() => onStatusChange("INACTIVE")}
        role="button"
        tabIndex={statusFilter === "INACTIVE" ? 0 : -1}
      >
        Nonaktif
      </button>
      <button
        className="filter-chip"
        style={chipStyles.ARCHIVED}
        onClick={() => onStatusChange("ARCHIVED")}
        role="button"
        tabIndex={statusFilter === "ARCHIVED" ? 0 : -1}
      >
        Diarsipkan
      </button>
      <Link
        href="#"
        className="filter-chip reset-chip"
        style={{
          flex: 1,
          height: 32,
          border: "1px solid #dce4ef",
          borderRadius: 6,
          background: "#fff",
          color: "#62728A",
          fontSize: 11,
          display: "grid",
          placeItems: "center",
          transition: "all 0.15s",
          cursor: "pointer",
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; }}
        onClick={() => {
          onStatusChange("ALL");
          // optional: reset search too
        }}
      >
        Reset
      </Link>
    </div>
  );
}