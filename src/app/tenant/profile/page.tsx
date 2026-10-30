"use client";

import { useEffect, useState } from "react";
import { Building2, FileText, MapPin, Save } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";
const PROVINCES_URL = "https://www.emsifa.com/api-wilayah-indonesia/v2/provinces.json";
const REGENCIES_URL = (id: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/regencies/${id}.json`;
const DISTRICTS_URL = (id: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/districts/${id}.json`;
const VILLAGES_URL = (id: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/villages/${id}.json`;

type Option = { id: string; name: string; type?: string };

export default function TenantProfilePage() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [regencies, setRegencies] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [villages, setVillages] = useState<Option[]>([]);
  const [form, setForm] = useState({
    provinceId: "",
    regencyId: "",
    districtId: "",
    villageId: "",
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    personInCharge: "",
    contactPhone: "",
    operationalHours: "",
    capacity: "",
    notes: "",
    reason: "",
  });

  useEffect(() => {
    fetch(PROVINCES_URL).then((r) => r.json()).then((j) => setProvinces(j.data ?? [])).catch(() => {});
    fetch(`${apiBase}/tenant/me`, { credentials: "include" }).then((r) => r.json()).then((d) => {
      const p = d.profile ?? {};
      setCode(d.tenantCode ?? p.officialCode ?? "");
      setForm((f) => ({
        ...f,
        provinceId: p.provinceCode ?? "",
        regencyId: p.regencyCode ?? "",
        districtId: p.districtCode ?? "",
        villageId: p.villageCode ?? "",
        name: p.sppgName ?? "",
        address: p.fullAddress ?? "",
        latitude: p.latitude != null ? String(p.latitude) : "",
        longitude: p.longitude != null ? String(p.longitude) : "",
        personInCharge: p.personInCharge ?? "",
        contactPhone: (p.contactPhone ?? "").replace(/^\+62/, ""),
        operationalHours: p.operationalHours ?? "",
        capacity: p.capacity != null ? String(p.capacity) : "",
        notes: p.notes ?? "",
      }));
    });
  }, []);

  useEffect(() => {
    if (!form.provinceId) return;
    fetch(REGENCIES_URL(form.provinceId)).then((r) => r.json()).then((j) => setRegencies((j.data ?? []).map((r: Option) => ({ id: r.id, name: r.name, type: r.name?.includes("Kota") ? "KOTA" : "KABUPATEN" })))).catch(() => {});
  }, [form.provinceId]);
  useEffect(() => {
    if (!form.regencyId) return;
    fetch(DISTRICTS_URL(form.regencyId)).then((r) => r.json()).then((j) => setDistricts(j.data ?? [])).catch(() => {});
  }, [form.regencyId]);
  useEffect(() => {
    if (!form.districtId) return;
    fetch(VILLAGES_URL(form.districtId)).then((r) => r.json()).then((j) => setVillages(j.data ?? [])).catch(() => {});
  }, [form.districtId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.reason.trim().length < 3) {
      setError("Alasan perubahan minimal 3 karakter.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const csrf = await fetch(`${apiBase}/auth/csrf`, { credentials: "include" }).then((r) => r.json());
      const res = await fetch(`${apiBase}/tenant/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.csrfToken },
        body: JSON.stringify({
          sppgName: form.name,
          fullAddress: form.address,
          contactPhone: form.contactPhone ? `+62${form.contactPhone}` : "",
          provinceCode: form.provinceId,
          regencyCode: form.regencyId,
          districtCode: form.districtId,
          villageCode: form.villageId,
          personInCharge: form.personInCharge,
          operationalHours: form.operationalHours,
          capacity: form.capacity ? Number(form.capacity) : null,
          notes: form.notes,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          reason: form.reason,
        }),
      });
      if (!res.ok) throw new Error(`Gagal menyimpan (${res.status})`);
      setToast("Profil SPPG tersimpan.");
      setForm((f) => ({ ...f, reason: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">Workspace SPPG &gt; Profil</p>
          <h1 className="page-title">Profil SPPG</h1>
          <p className="page-subtitle">Perbarui identitas, wilayah, dan lokasi unit Anda. Kode resmi tidak dapat diubah dari halaman ini.</p>
        </div>
      </header>
      {toast && <p className="demo-notice"><strong>{toast}</strong></p>}
      <section className="panel">
        {error && <p className="text-danger">{error}</p>}
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h2><Building2 size={16} /> Informasi dasar</h2>
            <div className="form-row two-col">
              <div>
                <label>Nama SPPG *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label>Kode SPPG</label>
                <input value={code} readOnly style={{ background: "#f3f4f6" }} />
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Nama penanggung jawab</label>
                <input value={form.personInCharge} onChange={(e) => setForm((f) => ({ ...f, personInCharge: e.target.value }))} />
              </div>
              <div>
                <label>Kontak kerja</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ padding: "8px 12px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4 }}>+62</span>
                  <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value.replace(/\D/g, "").replace(/^0/, "").replace(/^62/, "") }))} placeholder="8xxxxxxxxxx" />
                </div>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Jam operasional</label>
                <input value={form.operationalHours} onChange={(e) => setForm((f) => ({ ...f, operationalHours: e.target.value }))} placeholder="08:00-17:00" />
              </div>
              <div>
                <label>Kapasitas</label>
                <input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Porsi/hari" />
              </div>
            </div>
            <div className="form-row">
              <label>Catatan</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className="form-section">
            <h2><MapPin size={16} /> Wilayah</h2>
            <div className="form-row two-col">
              <div>
                <label>Provinsi *</label>
                <select required value={form.provinceId} onChange={(e) => setForm((f) => ({ ...f, provinceId: e.target.value, regencyId: "", districtId: "", villageId: "" }))}>
                  <option value="">Pilih provinsi</option>
                  {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label>Kabupaten/Kota *</label>
                <select required disabled={!form.provinceId} value={form.regencyId} onChange={(e) => setForm((f) => ({ ...f, regencyId: e.target.value, districtId: "", villageId: "" }))}>
                  <option value="">Pilih kabupaten/kota</option>
                  {regencies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Kecamatan *</label>
                <select required disabled={!form.regencyId} value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value, villageId: "" }))}>
                  <option value="">Pilih kecamatan</option>
                  {districts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label>Kelurahan</label>
                <select disabled={!form.districtId} value={form.villageId} onChange={(e) => setForm((f) => ({ ...f, villageId: e.target.value }))}>
                  <option value="">Pilih kelurahan</option>
                  {villages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2><MapPin size={16} /> Lokasi</h2>
            <LocationPicker latitude={form.latitude} longitude={form.longitude} height="280px" onLocationSelect={(lat, lng) => setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} />
            <div className="form-row" style={{ marginTop: 12 }}>
              <label>Alamat</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Alamat lengkap" style={{ flex: 1 }} />
                <button type="button" className="btn btn-primary" onClick={async () => {
                  if (!form.address.trim()) return;
                  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1`);
                  const data = await res.json();
                  if (data?.[0]) setForm((f) => ({ ...f, latitude: Number(data[0].lat).toFixed(6), longitude: Number(data[0].lon).toFixed(6) }));
                  else setError("Alamat tidak ditemukan di peta");
                }}><MapPin size={16} /></button>
              </div>
            </div>
            <div className="form-row two-col">
              <div><label>Latitude *</label><input required value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} /></div>
              <div><label>Longitude *</label><input required value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} /></div>
            </div>
          </div>

          <div className="form-section">
            <h2><FileText size={16} /> Audit</h2>
            <div className="form-row">
              <label>Alasan perubahan *</label>
              <textarea required minLength={3} rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Minimal 3 karakter" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan profil"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
