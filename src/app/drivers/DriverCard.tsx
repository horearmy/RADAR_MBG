import Link from "next/link";
import { ArrowUpRight, Edit, MapPin, Phone, UserRound } from "lucide-react";

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
  phone?: string | null;
  sppg?: { name: string; code: string } | null;
  tenant?: { tenantCode: string; name: string } | null;
};

type DriverCardProps = {
  row: DriverRow;
  onView: (id: string) => void;
  hasManagePermission: boolean;
};

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE": return "Aktif";
    case "SUSPENDED": return "Perhatian";
    case "INACTIVE": return "Nonaktif";
    case "ARCHIVED": return "Diarsipkan";
    default: return status;
  }
}

export function DriverCard({ row, onView, hasManagePermission }: DriverCardProps) {
  const initials = row.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <article className="drivers-card">
      <button className="drivers-card-main" type="button" onClick={() => onView(row.id)} aria-label={`Lihat detail ${row.name}`}>
        <span className="drivers-avatar">{initials || <UserRound size={19} />}</span>
        <span className="drivers-identity"><strong>{row.name}</strong><span><code>{row.code}</code><i>·</i>{row.sppg?.code ?? "Driver"}<i>·</i>{row.tenant?.tenantCode ?? "Tenant"}</span></span>
        <span className={`drivers-status ${`drivers-status-${row.status.toLowerCase()}`}`}><i />{statusLabel(row.status)}</span>
        <ArrowUpRight className="drivers-card-arrow" size={17} />
      </button>
      <div className="drivers-card-meta">
        <span><MapPin size={14} />{row.sppg?.name ?? row.region?.name ?? row.organization?.name ?? "Lokasi belum ditentukan"}{row.tenant?.name ? ` · ${row.tenant.name}` : ""}</span>
        {row.phone ? <a href={`tel:${row.phone}`} onClick={(event) => event.stopPropagation()}><Phone size={14} />{row.phone}</a> : <span className="drivers-meta-muted"><Phone size={14} />Nomor belum tersedia</span>}
        {row.address && <span className="drivers-address">{row.address}</span>}
        <span className="drivers-card-actions">
          <Link href={`/drivers/${row.id}`} aria-label={`Detail ${row.name}`}><ArrowUpRight size={15} />Detail</Link>
          {hasManagePermission && <Link href={`/drivers/${row.id}/edit`} aria-label={`Edit ${row.name}`}><Edit size={14} />Edit</Link>}
        </span>
      </div>
    </article>
  );
}
