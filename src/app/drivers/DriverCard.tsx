import Link from "next/link";
import { MapPin } from "lucide-react";

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

type DriverCardProps = {
  row: DriverRow;
  onView: (id: string) => void;
  hasManagePermission: boolean;
};

export function DriverCard({ row, onView, hasManagePermission }: DriverCardProps) {
  return (
    <div
      className="driver-card"
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
      onClick={() => onView(row.id)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
        <div style={{ flex: "1", minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "#1d2b40", fontWeight: 500 }}>
            {row.name}
          </div>
          <div style={{ fontSize: 12, color: "#62728a", marginTop: 2 }}>
            {row.code ?? "-"}
          </div>
        </div>

        <div style={{ flex: "0 0 120px", fontSize: 12, color: "#62728a" }}>
          <div>{row.address ?? "Koordinat belum diisi"}</div>
          {row.latitude && row.longitude && (
            <div style={{ marginTop: 1, fontSize: 11, color: "#62728a" }}>
              {row.latitude}, {row.longitude}
            </div>
          )}
        </div>

        <div style={{ flex: "0 0 100px", fontSize: 12, color: "#62728a" }}>
          {row.region?.name ?? "-"}
        </div>
        <div style={{ flex: "0 0 120px", fontSize: 12, color: "#62728a" }}>
          {row.organization?.name ?? "-"}
        </div>
      </div>

      <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link
          className="icon-btn"
          href={`/drivers/${row.id}`}
          title="Detail"
          style={{
            width: 32,
            height: 32,
            borderRadius: 50,
            background: "#f9fbfd",
            display: "grid",
            placeItems: "center",
            color: "#4d7bab",
            fontSize: 18,
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = "#e8f0fa"; }}
          onMouseOut={(e) => { e.currentTarget.style.background = "#f9fbfd"; }}
        >
          <MapPin size={16} />
        </Link>

        {hasManagePermission && (
          <Link
            className="icon-btn"
            href={`/drivers/${row.id}/edit`}
            title="Edit"
            style={{
              width: 32,
              height: 32,
              borderRadius: 50,
              background: "#f9fbfd",
              display: "grid",
              placeItems: "center",
              color: "#4d7bab",
              fontSize: 18,
              transition: "background 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#e8f0fa"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#f9fbfd"; }}
          >
            <MapPin size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}