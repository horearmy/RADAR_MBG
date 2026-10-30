"use client";

import { useEffect, useState } from "react";
import { Building2, MapPin, Save } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";
const PROVINCES_URL = "https://www.emsifa.com/api-wilayah-indonesia/v2/provinces.json";
const REGENCIES_URL = (id: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/regencies/${id}.json`;
const DISTRICTS_URL = (id: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/districts/${id}.json`;
const VILLAGES_URL = (id: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/villages/${id}.json`;

type Option = { id: string; name: string; type?: string };

export default function RegisterPage() {
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [regencies, setRegencies] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [villages, setVillages] = useState<Option[]>([]);
  const [form, setForm] = useState({
    sppgName: "",
    provinceId: "",
    regencyId: "",
    districtId: "",
    villageId: "",
    fullAddress: "",
    latitude: "",
    longitude: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(PROVINCES_URL).then((r) => r.json()).then((j) => setProvinces(j.data ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!form.provinceId) { setRegencies([]); setDistricts([]); setVillages([]); return; }
    fetch(REGENCIES_URL(form.provinceId)).then((r) => r.json()).then((j) => setRegencies((j.data ?? []).map((r: any) => ({ id: r.id, name: r.name, type: r.name.includes("Kota") ? "KOTA" : "KABUPATEN" })))).catch(() => {});
  }, [form.provinceId]);
  useEffect(() => {
    if (!form.regencyId) { setDistricts([]); setVillages([]); return; }
    fetch(DISTRICTS_URL(form.regencyId)).then((r) => r.json()).then((j) => setDistricts(j.data ?? [])).catch(() => {});
  }, [form.regencyId]);
  useEffect(() => {
    if (!form.districtId) { setVillages([]); return; }
    fetch(VILLAGES_URL(form.districtId)).then((r) => r.json()).then((j) => setVillages(j.data ?? [])).catch(() => {});
  }, [form.districtId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const province = provinces.find((p) => p.id === form.provinceId);
      const regency = regencies.find((r) => r.id === form.regencyId);
      const district = districts.find((d) => d.id === form.districtId);
      const village = villages.find((v) => v.id === form.villageId);
      const csrf = await fetch(`${apiBase}/auth/csrf`, { credentials: "include" }).then((r) => r.json());
      const res = await fetch(`${apiBase}/public/sppg-registrations`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.csrfToken },
        body: JSON.stringify({
          sppgName: form.sppgName,
          provinceCode: province?.id ?? "",
          regencyCode: regency?.id ?? "",
          districtCode: district?.id ?? "",
          villageCode: village?.id ?? "",
          fullAddress: form.fullAddress,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
        }),
      });
      if (!res.ok) throw new Error(`Gagal menyimpan (${res.status})`);
      const json = await res.json();
      setToast(`Pendaftaran berhasil. Nomor registrasi: ${json.registrationNumber}`);
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
          <p className="page-breadcrumb">Pendaftaran SPPG</p>
          <h1 className="page-title">Daftar SPPG Baru</h1>
          <p className="page-subtitle">Lengkapi data unit SPPG. Tim platform akan memverifikasi pendaftaran Anda.</p>
        </div>
      </header>
      {toast && <p className="demo-notice"><strong>{toast}</strong></p>}
      {error && <p className="text-danger">{error}</p>}
      <section className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h2><Building2 size={16} /> Informasi SPPG</h2>
            <div className="form-row">
              <label>Nama SPPG *</label>
              <input required value={form.sppgName} onChange={(e) => setForm((f) => ({ ...f, sppgName: e.target.value }))} placeholder="Nama unit SPPG" />
            </div>
            <div className="form-row two-col">
              <div>
                <label>Nama penanggung jawab *</label>
                <input required value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Nama PIC" />
              </div>
              <div>
                <label>Kontak kerja *</label>
                <input required value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="08xxxxxxxxxx" />
              </div>
            </div>
            <div className="form-row">
              <label>Email *</label>
              <input required type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="email@contoh.id" />
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
                  {regencies.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
                </select>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Kecamatan *</label>
                <select required disabled={!form.regencyId} value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value, villageId: "" }))}>
                  <option value="">Pilih kecamatan</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label>Kelurahan</label>
                <select disabled={!form.districtId} value={form.villageId} onChange={(e) => setForm((f) => ({ ...f, villageId: e.target.value }))}>
                  <option value="">Pilih kelurahan</option>
                  {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>Alamat lengkap *</label>
              <textarea required rows={2} value={form.fullAddress} onChange={(e) => setForm((f) => ({ ...f, fullAddress: e.target.value }))} />
            </div>
          </div>

          <div className="form-section">
            <h2><MapPin size={16} /> Lokasi</h2>
            <LocationPicker latitude={form.latitude} longitude={form.longitude} height="260px" onLocationSelect={(lat, lng) => setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))} />
            <div className="form-row two-col" style={{ marginTop: 12 }}>
              <div><label>Latitude</label><input value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="-6.200000" /></div>
              <div><label>Longitude</label><input value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="106.816666" /></div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Mengirim..." : "Kirim pendaftaran"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
