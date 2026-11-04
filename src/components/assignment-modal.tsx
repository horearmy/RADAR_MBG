"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Car, X } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

const apiBase = apiBaseUrl;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sppgId: string;
  driverId: string;
  driverName: string;
  vehicles: any[];
};

export function AssignmentModal({ open, onClose, onSuccess, sppgId, driverId, driverName, vehicles }: Props) {
  const [form, setForm] = useState({ vehicleId: "", effectiveFrom: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setForm({ vehicleId: "", effectiveFrom: now.toISOString().slice(0, 16), reason: "" });
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const available = vehicles.filter((v) => v.sppgId === sppgId && v.status === "ACTIVE");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId) return setError("Pilih kendaraan");
    if (!form.effectiveFrom) return setError("Tanggal efektif wajib diisi");
    if (!form.reason.trim() || form.reason.trim().length < 3) return setError("Alasan minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const csrfData = await csrfRes.json().catch(() => null) as { csrfToken?: string } | null;
      if (!csrfRes.ok || !csrfData?.csrfToken) {
        throw new Error("Gagal memulai sesi keamanan. Muat ulang halaman lalu coba lagi.");
      }
      const csrfToken = csrfData.csrfToken;
      const res = await fetch(`${apiBase}/admin/assignments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({
          sppgId,
          driverId,
          vehicleId: form.vehicleId,
          effectiveFrom: new Date(form.effectiveFrom).toISOString(),
          reason: form.reason.trim(),
        }),
      });
      const raw = await res.text();
      let json: { message?: string; error?: { message?: string } } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? `Gagal menugaskan kendaraan (HTTP ${res.status})`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menugaskan kendaraan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="trip-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="trip-modal trip-create-modal" role="dialog" aria-modal="true">
        <button className="trip-modal-close" onClick={onClose} disabled={saving} aria-label="Tutup"><X size={17} /></button>
        <div className="trip-create-heading">
          <span className="trip-modal-icon primary"><Car size={19} /></span>
          <div>
            <h2>Atur Penugasan Kendaraan</h2>
            <p>Menugaskan kendaraan aktif untuk driver <strong>{driverName}</strong></p>
          </div>
        </div>
        <form className="trip-create-form" onSubmit={submit}>
          <label className="trip-form-field">
            <span><Car size={12} /> Kendaraan</span>
            <select value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))} disabled={saving}>
              <option value="">Pilih kendaraan</option>
              {available.map((v) => (
                <option key={v.id} value={v.id}>{v.plateNumber}{v.label ? ` • ${v.label}` : ""}</option>
              ))}
            </select>
            {available.length === 0 && <small>Tidak ada kendaraan aktif untuk SPPG ini</small>}
          </label>
          <label className="trip-form-field">
            <span><CalendarClock size={12} /> Berlaku Mulai</span>
            <input type="datetime-local" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} disabled={saving} />
          </label>
          <label className="trip-form-field">
            <span>Alasan Penugasan</span>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Minimal 3 karakter" disabled={saving} />
          </label>
          {error && <div className="trip-modal-error"><span>{error}</span></div>}
          <div className="trip-modal-actions">
            <button type="button" className="trip-action-button muted" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="trip-action-button primary" disabled={saving || available.length === 0}>{saving ? "Menyimpan..." : "Tugaskan Kendaraan"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
