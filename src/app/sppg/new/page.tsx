"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, RefreshCw, Save } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:4000/api/v1";

const PROVINCES_URL = "https://www.emsifa.com/api-wilayah-indonesia/v2/provinces.json";
const REGENCIES_URL = (provinceId: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/regencies/${provinceId}.json`;
const DISTRICTS_URL = (regencyId: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/districts/${regencyId}.json`;
const VILLAGES_URL = (districtId: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/villages/${districtId}.json`;

type Province = { id: string; code: string; name: string };
type Regency = { id: string; code: string; name: string; provinceId: string; type: string };
type District = { id: string; code: string; name: string; regencyId: string };
type Village = { id: string; code: string; name: string; districtId: string };
type Institution = { id: string; code: string; name: string; type: string };

export default function SppgNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Region data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  // Region loading states
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [form, setForm] = useState({
    organizationId: "",
    provinceId: "",
    regencyId: "",
    districtId: "",
    villageId: "",
    institutionId: "",
    code: "",
    name: "",
    status: "ACTIVE",
    category: "",
    description: "",
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

  const load = useCallback(async () => {
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const [orgRes, instRes] = await Promise.all([
        fetch(`${apiBase}/admin/organizations?page=1&pageSize=100`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/admin/institutions`, { credentials: "include", cache: "no-store" }),
      ]);
      if (orgRes.ok) setOrganizations((await orgRes.json()).data ?? []);
      if (instRes.ok) setInstitutions((await instRes.json()).data ?? []);

      // Load provinces from emsifa
      setLoadingProvinces(true);
      const provRes = await fetch(PROVINCES_URL);
      if (provRes.ok) {
        const json = await provRes.json();
        setProvinces(json.data ?? []);
      } else {
        setProvinces([
          { id: "11", code: "11", name: "ACEH" },
          { id: "12", code: "12", name: "SUMATERA UTARA" },
          { id: "31", code: "31", name: "DKI JAKARTA" },
          { id: "32", code: "32", name: "JAWA BARAT" },
          { id: "33", code: "33", name: "JAWA TENGAH" },
          { id: "34", code: "34", name: "DI YOGYAKARTA" },
          { id: "35", code: "35", name: "JAWA TIMUR" },
          { id: "36", code: "36", name: "BANTEN" },
        ]);
      }
    } catch {
      setProvinces([
        { id: "11", code: "11", name: "ACEH" },
        { id: "12", code: "12", name: "SUMATERA UTARA" },
        { id: "31", code: "31", name: "DKI JAKARTA" },
        { id: "32", code: "32", name: "JAWA BARAT" },
        { id: "33", code: "33", name: "JAWA TENGAH" },
        { id: "34", code: "34", name: "DI YOGYAKARTA" },
        { id: "35", code: "35", name: "JAWA TIMUR" },
        { id: "36", code: "36", name: "BANTEN" },
      ]);
    } finally {
      setLoadingProvinces(false);
    }
  }, []);

  // Load regencies when province changes
  useEffect(() => {
    if (!form.provinceId) {
      setRegencies([]);
      setDistricts([]);
      setVillages([]);
      return;
    }
    setLoadingRegencies(true);
    fetch(REGENCIES_URL(form.provinceId))
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          setRegencies(json.data.map((r: any) => ({ id: r.id, code: r.id, name: r.name, provinceId: form.provinceId, type: r.name.includes("Kota") ? "KOTA" : "KABUPATEN" })));
        } else {
          setRegencies([
            { id: "1", code: "JKT", name: "Jakarta Pusat", provinceId: form.provinceId, type: "KOTA" },
            { id: "2", code: "BDG", name: "Bandung", provinceId: form.provinceId, type: "KOTA" },
            { id: "3", code: "SBY", name: "Surabaya", provinceId: form.provinceId, type: "KOTA" },
          ]);
        }
      })
      .catch(() => {
        setRegencies([
          { id: "1", code: "JKT", name: "Jakarta Pusat", provinceId: form.provinceId, type: "KOTA" },
          { id: "2", code: "BDG", name: "Bandung", provinceId: form.provinceId, type: "KOTA" },
          { id: "3", code: "SBY", name: "Surabaya", provinceId: form.provinceId, type: "KOTA" },
        ]);
      })
      .finally(() => setLoadingRegencies(false));
  }, [form.provinceId]);

  // Load districts when regency changes
  useEffect(() => {
    if (!form.regencyId) {
      setDistricts([]);
      setVillages([]);
      return;
    }
    setLoadingDistricts(true);
    fetch(DISTRICTS_URL(form.regencyId))
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          setDistricts(json.data.map((d: any) => ({ id: d.id, code: d.id, name: d.name, regencyId: form.regencyId })));
        } else {
          setDistricts([
            { id: "1", code: "DIST1", name: "Kecamatan 1", regencyId: form.regencyId },
            { id: "2", code: "DIST2", name: "Kecamatan 2", regencyId: form.regencyId },
          ]);
        }
      })
      .catch(() => {
        setDistricts([
          { id: "1", code: "DIST1", name: "Kecamatan 1", regencyId: form.regencyId },
          { id: "2", code: "DIST2", name: "Kecamatan 2", regencyId: form.regencyId },
        ]);
      })
      .finally(() => setLoadingDistricts(false));
  }, [form.regencyId]);

  // Load villages when district changes
  useEffect(() => {
    if (!form.districtId) {
      setVillages([]);
      return;
    }
    setLoadingVillages(true);
    fetch(VILLAGES_URL(form.districtId))
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          setVillages(json.data.map((v: any) => ({ id: v.id, code: v.id, name: v.name, districtId: form.districtId })));
        } else {
          setVillages([
            { id: "1", code: "VIL1", name: "Kelurahan 1", districtId: form.districtId },
            { id: "2", code: "VIL2", name: "Kelurahan 2", districtId: form.districtId },
          ]);
        }
      })
      .catch(() => {
        setVillages([
          { id: "1", code: "VIL1", name: "Kelurahan 1", districtId: form.districtId },
          { id: "2", code: "VIL2", name: "Kelurahan 2", districtId: form.districtId },
        ]);
      })
      .finally(() => setLoadingVillages(false));
  }, [form.districtId]);

  const generateCode = useCallback(async (organizationId: string) => {
    if (!organizationId) return;
    setGeneratingCode(true);
    try {
      const res = await fetch(`${apiBase}/admin/sppg/next-code?organizationId=${organizationId}`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setForm((f) => ({ ...f, code: json.code ?? "" }));
      } else {
        const org = organizations.find((o) => o.id === organizationId);
        const orgCode = org?.code ?? "ORG";
        const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
        setForm((f) => ({ ...f, code: `SPPG-${orgCode}-${seq}` }));
      }
    } catch {
      const org = organizations.find((o) => o.id === organizationId);
      const orgCode = org?.code ?? "ORG";
      const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
      setForm((f) => ({ ...f, code: `SPPG-${orgCode}-${seq}` }));
    } finally { setGeneratingCode(false); }
  }, [organizations]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (form.organizationId) {
      void generateCode(form.organizationId);
    }
  }, [form.organizationId, generateCode]);

  // Track unsaved changes
  useEffect(() => {
    const original = { organizationId: "", provinceId: "", regencyId: "", districtId: "", villageId: "", institutionId: "", code: "", name: "", status: "ACTIVE", category: "", description: "", address: "", latitude: "", longitude: "", personInCharge: "", contactPhone: "", operationalHours: "", capacity: "", notes: "", reason: "" };
    const hasChanges = JSON.stringify(form) !== JSON.stringify(original);
    setHasUnsavedChanges(hasChanges);
  }, [form]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organizationId) return setError("Organisasi wajib dipilih");
    if (!form.provinceId) return setError("Provinsi wajib dipilih");
    if (!form.regencyId) return setError("Kabupaten/Kota wajib dipilih");
    if (!form.districtId) return setError("Kecamatan wajib dipilih");
    if (!form.code.trim()) return setError("Kode SPPG wajib diisi");
    if (!form.name.trim()) return setError("Nama SPPG wajib diisi");
    if (form.latitude === "" || form.longitude === "") return setError("Latitude dan Longitude wajib diisi");
    if (!form.reason.trim() || form.reason.trim().length < 3) return setError("Alasan wajib diisi minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const res = await fetch(`${apiBase}/admin/sppg`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({
          organizationId: form.organizationId,
          provinceId: form.provinceId,
          regencyId: form.regencyId,
          districtId: form.districtId,
          villageId: form.villageId || undefined,
          institutionId: form.institutionId || undefined,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          status: form.status,
          category: form.category.trim() || undefined,
          description: form.description.trim() || undefined,
          address: form.address.trim() || undefined,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          personInCharge: form.personInCharge.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
          operationalHours: form.operationalHours.trim() || undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          notes: form.notes.trim() || undefined,
          reason: form.reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? "Gagal menyimpan");
      setHasUnsavedChanges(false);
      router.push("/sppg");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (user && !hasPermission(user, "master:manage")) {
    return (
      <main className="page">
        <header className="page-header"><div><h1 className="page-title">Tambah SPPG</h1></div></header>
        <div className="panel"><p className="text-secondary">Akses terbatas.</p></div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-breadcrumb">Operasional &gt; SPPG &gt; Tambah</p>
          <h1 className="page-title">Tambah SPPG</h1>
          <p className="page-subtitle">Tambahkan unit SPPG baru.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => router.push("/sppg")}><ArrowLeft size={16} /> Kembali</button>
        </div>
      </header>

      <section className="panel">
        {error && <p className="text-danger">{error}</p>}
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-section">
            <h2>Informasi dasar</h2>
            <div className="form-row two-col">
              <div>
                <label>Organisasi *</label>
                <select value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value, provinceId: "", regencyId: "", districtId: "", villageId: "", code: "" }))} required>
                  <option value="">Pilih organisasi</option>
                  {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Aktif</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Ditangguhkan</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Kode SPPG *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="SPPG-BGC-001"
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => form.organizationId && generateCode(form.organizationId)}
                    disabled={!form.organizationId || generatingCode}
                    title="Generate kode baru"
                    style={{ minWidth: "40px" }}
                  >
                    <RefreshCw size={16} className={generatingCode ? "spin" : ""} />
                  </button>
                </div>
                <small style={{ color: "#7b8a9d", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  Kode otomatis di-generate saat organisasi dipilih. Format: SPPG-&#123;KODE_ORGANISASI&#125;-&#123;NOMOR_URUT&#125;
                </small>
              </div>
              <div>
                <label>Nama SPPG *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Jenis/kategori unit</label>
                <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Opsional" />
              </div>
              <div>
                <label>Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Opsional" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Wilayah</h2>
            <div className="form-row two-col">
              <div>
                <label>Provinsi *</label>
                <select value={form.provinceId} onChange={(e) => setForm((f) => ({ ...f, provinceId: e.target.value, regencyId: "", districtId: "", villageId: "" }))} required>
                  <option value="">Pilih provinsi</option>
                  {loadingProvinces && <option disabled>Memuat...</option>}
                  {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label>Kabupaten/Kota *</label>
                <select value={form.regencyId} onChange={(e) => setForm((f) => ({ ...f, regencyId: e.target.value, districtId: "", villageId: "" }))} required disabled={!form.provinceId}>
                  <option value="">Pilih kabupaten/kota</option>
                  {loadingRegencies && <option disabled>Memuat...</option>}
                  {regencies.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
                </select>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Kecamatan *</label>
                <select value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value, villageId: "" }))} required disabled={!form.regencyId}>
                  <option value="">Pilih kecamatan</option>
                  {loadingDistricts && <option disabled>Memuat...</option>}
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label>Kelurahan</label>
                <select value={form.villageId} onChange={(e) => setForm((f) => ({ ...f, villageId: e.target.value }))} disabled={!form.districtId}>
                  <option value="">Pilih kelurahan (opsional)</option>
                  {loadingVillages && <option disabled>Memuat...</option>}
                  {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>Instansi (opsional)</label>
              <select value={form.institutionId} onChange={(e) => setForm((f) => ({ ...f, institutionId: e.target.value }))}>
                <option value="">Pilih instansi</option>
                {institutions.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h2>Lokasi</h2>
            <div className="form-row">
              <label>Alamat</label>
              <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={3} />
            </div>
            <div className="form-row two-col">
              <div>
                <label>Latitude *</label>
                <input value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="-6.200000" required />
              </div>
              <div>
                <label>Longitude *</label>
                <input value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="106.816666" required />
              </div>
            </div>
            <div className="form-row">
              <button type="button" className="btn btn-ghost" onClick={() => setShowMap((v) => !v)}>
                <MapPin size={16} /> {showMap ? "Tutup Peta" : "Pilih di Peta"}
              </button>
            </div>
            {showMap && (
              <div className="form-row">
                <LocationPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onLocationSelect={(lat, lng) => {
                    setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
                  }}
                  height="280px"
                />
                <small style={{ color: "#7b8a9d", fontSize: "11px", marginTop: "4px" }}>
                  Klik pada peta untuk memilih lokasi. Koordinat akan otomatis terisi.
                </small>
              </div>
            )}
            {(form.latitude && form.longitude) && (
              <div className="form-row">
                <small style={{ color: "#7b8a9d", fontSize: "11px" }}>
                  Preview: {form.latitude}, {form.longitude}
                </small>
              </div>
            )}
          </div>

          <div className="form-section">
            <h2>Penanggung jawab</h2>
            <div className="form-row two-col">
              <div>
                <label>Nama penanggung jawab</label>
                <input value={form.personInCharge} onChange={(e) => setForm((f) => ({ ...f, personInCharge: e.target.value }))} placeholder="Opsional" />
              </div>
              <div>
                <label>Kontak kerja</label>
                <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="Opsional" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Operasional</h2>
            <div className="form-row two-col">
              <div>
                <label>Jam operasional</label>
                <input value={form.operationalHours} onChange={(e) => setForm((f) => ({ ...f, operationalHours: e.target.value }))} placeholder="Opsional, contoh: 08:00-17:00" />
              </div>
              <div>
                <label>Kapasitas produksi/distribusi</label>
                <input value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Opsional" type="number" />
              </div>
            </div>
            <div className="form-row">
              <label>Catatan operasional</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Opsional" />
            </div>
          </div>

          <div className="form-section">
            <h2>Audit</h2>
            <div className="form-row">
              <label>Alasan penambahan *</label>
              <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} required placeholder="Minimal 3 karakter" />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={() => router.push("/sppg")}>Batal</button>
            <button className="btn btn-ghost" type="button" disabled={saving}>Simpan Draft</button>
            <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan SPPG"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
