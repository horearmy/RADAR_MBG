"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, FileText, MapPin, RefreshCw, Save } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { apiBaseUrl, getCurrentSession, hasPermission, type SessionUser } from "@/lib/api";

const apiBase = apiBaseUrl;

const PROVINCES_URL = "https://www.emsifa.com/api-wilayah-indonesia/v2/provinces.json";
const REGENCIES_URL = (provinceId: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/regencies/${provinceId}.json`;
const DISTRICTS_URL = (regencyId: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/districts/${regencyId}.json`;
const VILLAGES_URL = (districtId: string) => `https://www.emsifa.com/api-wilayah-indonesia/v2/villages/${districtId}.json`;

type Province = { id: string; code: string; name: string };
type Regency = { id: string; code: string; name: string; provinceId: string; type: string };
type District = { id: string; code: string; name: string; regencyId: string };
type Village = { id: string; code: string; name: string; districtId: string };

export default function SppgNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultOrgId, setDefaultOrgId] = useState<string>("");
  const [defaultRegionId, setDefaultRegionId] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  // showMap removed - map always visible now
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);

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
    code: "",
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

  const load = useCallback(async () => {
    try {
      const session = await getCurrentSession().catch(() => null);
      if (session) setUser(session);
      const orgRes = await fetch(`${apiBase}/admin/organizations?page=1&pageSize=100`, { credentials: "include", cache: "no-store" });
      if (orgRes.ok) {
        const orgs = (await orgRes.json()).data ?? [];
        if (orgs.length > 0) setDefaultOrgId(orgs[0].id);
      }
      const regRes = await fetch(`${apiBase}/admin/regions?page=1&pageSize=100`, { credentials: "include", cache: "no-store" });
      if (regRes.ok) {
        const regs = (await regRes.json()).data ?? [];
        if (regs.length > 0) setDefaultRegionId(regs[0].id);
      }

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

  // Auto-geocode wilayah ke peta saat semua dropdown terisi
  useEffect(() => {
    if (!form.provinceId || !form.regencyId || !form.districtId) return;

    const province = provinces.find((p) => p.id === form.provinceId);
    const regency = regencies.find((r) => r.id === form.regencyId);
    const district = districts.find((d) => d.id === form.districtId);
    const village = form.villageId ? villages.find((v) => v.id === form.villageId) : null;

    if (!province || !regency || !district) return;

    const queryParts = [village?.name, district.name, regency.name, province.name]
      .filter(Boolean)
      .join(", ");

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryParts)}&limit=1&countrycodes=id`,
          { headers: { "Accept-Language": "id" }, signal: controller.signal }
        );
        const data = await res.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          setForm((f) => ({ ...f, latitude: Number(lat).toFixed(6), longitude: Number(lon).toFixed(6) }));
        }
      } catch {
        // ignore abort / network errors
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.provinceId, form.regencyId, form.districtId, form.villageId, provinces, regencies, districts, villages]);

  const generateCode = useCallback(() => {
    setGeneratingCode(true);
    const orgCode = "SPPG";
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    setForm((f) => ({ ...f, code: `${orgCode}-${seq}` }));
    setGeneratingCode(false);
  }, []);

  // Mapping regencyId ke regionId UUID format
  // Saat ini menggunakan format UUID placeholder berdasarkan emsifa code
  // Backend akan menerima ini hingga database region data tersedia
  const mapRegencyToRegionId = (regencyId: string | string[]): string => {
    if (!regencyId) return "";
    const id = typeof regencyId === "string" ? regencyId : regencyId[0];
    // Generate UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const randomPart = Math.random().toString(36).substring(2, 20);
    // Insert version 4 and variant bits
    const uuid = `${randomPart.substring(0, 8)}-${randomPart.substring(8, 12)}-4${randomPart.substring(12, 16)}-${randomPart.substring(16, 20)}-${Math.random().toString(36).substring(2, 20)}`;
    return `region-${id}-${uuid}`;
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (defaultOrgId && !form.code) {
      generateCode();
    }
  }, [defaultOrgId, form.code, generateCode]);

  useEffect(() => {
    const original = { organizationId: "", provinceId: "", regencyId: "", districtId: "", villageId: "", code: "", name: "", address: "", latitude: "", longitude: "", personInCharge: "", contactPhone: "", operationalHours: "", capacity: "", notes: "", reason: "" };
    const hasChanges = JSON.stringify(form) !== JSON.stringify(original);
    setHasUnsavedChanges(hasChanges);
  }, [form]);

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
    if (!defaultOrgId) return setError("Organisasi belum tersedia");
    if (!defaultRegionId) return setError("Wilayah belum tersedia");
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
      const csrfData = await csrfRes.json().catch(() => null) as { csrfToken?: string } | null;
      if (!csrfRes.ok || !csrfData?.csrfToken) {
        throw new Error("Gagal memulai sesi keamanan. Muat ulang halaman lalu coba lagi.");
      }
      const csrfToken = csrfData.csrfToken;
      const res = await fetch(`${apiBase}/admin/sppg`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({
          organizationId: defaultOrgId,
          regionId: defaultRegionId,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
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
      if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? `Gagal menyimpan (HTTP ${res.status})`);
      setHasUnsavedChanges(false);
      setToast({ message: "SPPG berhasil disimpan", type: "success" });
      setTimeout(() => router.push("/sppg"), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setError(msg);
      setToast({ message: msg, type: "error" });
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
    <>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 20px",
            borderRadius: "12px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: "0 12px 32px rgba(16, 36, 64, 0.25)",
            background: toast.type === "success" ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #dc2626, #b91c1c)",
            minWidth: "280px",
            maxWidth: "480px",
            animation: "slideDown 0.3s ease-out",
          }}
        >
          <span style={{ fontSize: "20px" }}>{toast.type === "success" ? "✓" : "✕"}</span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: "14px",
            }}
          >
            ×
          </button>
        </div>
      )}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
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
            <h2><Building2 size={16} /> Informasi dasar</h2>
            <div className="form-row two-col">
              <div>
                <label>Nama SPPG *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Nama unit SPPG" />
              </div>
              <div>
                <label>Kode SPPG *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={form.code}
                    readOnly
                    placeholder="SPPG-001"
                    required
                    style={{ flex: 1, background: "#f3f4f6", cursor: "not-allowed" }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => generateCode()}
                    disabled={generatingCode}
                    title="Generate kode baru"
                    style={{ minWidth: "40px" }}
                  >
                    <RefreshCw size={16} className={generatingCode ? "spin" : ""} />
                  </button>
                </div>
                <small style={{ color: "#7b8a9d", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  Kode otomatis di-generate. Format: SPPG-&#123;NOMOR_URUT&#125;
                </small>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Nama penanggung jawab (opsional)</label>
                <input value={form.personInCharge} onChange={(e) => setForm((f) => ({ ...f, personInCharge: e.target.value }))} placeholder="Nama PIC" />
              </div>
              <div>
                <label>Kontak kerja (opsional)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ padding: "8px 12px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "14px", color: "#374151", whiteSpace: "nowrap" }}>+62</span>
                  <input
                    value={form.contactPhone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "");
                      if (val.startsWith("0")) val = val.slice(1);
                      if (val.startsWith("62")) val = val.slice(2);
                      setForm((f) => ({ ...f, contactPhone: val }));
                    }}
                    placeholder="8xxxxxxxxxx"
                    style={{ flex: 1 }}
                  />
                </div>
                <small style={{ color: "#7b8a9d", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  Masukkan nomor tanpa kode negara. Contoh: 81234567890
                </small>
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Jam operasional (opsional)</label>
                <input value={form.operationalHours} onChange={(e) => setForm((f) => ({ ...f, operationalHours: e.target.value }))} placeholder="08:00-17:00" />
              </div>
              <div>
                <label>Kapasitas (opsional)</label>
                <input value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Jumlah porsi/hari" type="number" />
              </div>
            </div>
            <div className="form-row">
              <label>Catatan (opsional)</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Catatan operasional" />
            </div>
          </div>

          <div className="form-section">
            <h2><MapPin size={16} /> Wilayah</h2>
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
          </div>

          <div className="form-section">
            <h2><MapPin size={16} /> Lokasi</h2>
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
            <div className="form-row">
              <label>Cari alamat (otomatis menandai peta)</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const btn = (e.currentTarget.parentElement?.querySelector("button") as HTMLButtonElement);
                      btn?.click();
                    }
                  }}
                  placeholder="Contoh: Jl. Sudirman No. 1, Jakarta"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!form.address.trim()) return;
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1`, { headers: { "Accept-Language": "id" } });
                      const data = await res.json();
                      if (data && data.length > 0) {
                        const { lat, lon } = data[0];
                        setForm((f) => ({ ...f, latitude: Number(lat).toFixed(6), longitude: Number(lon).toFixed(6) }));
                      } else {
                        setError("Alamat tidak ditemukan di peta");
                      }
                    } catch {
                      setError("Gagal mencari alamat");
                    }
                  }}
                  disabled={!form.address.trim()}
                  style={{ minWidth: "40px" }}
                  title="Cari alamat di peta"
                >
                  <MapPin size={16} />
                </button>
              </div>
              <small style={{ color: "#7b8a9d", fontSize: "11px", marginTop: "4px", display: "block" }}>
                Ketik alamat lalu klik tombol cari untuk menandai lokasi di peta.
              </small>
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
            {(form.latitude && form.longitude) && (
              <div className="form-row">
                <small style={{ color: "#16a34a", fontSize: "11px" }}>
                  ✓ Koordinat terisi: {form.latitude}, {form.longitude}
                </small>
              </div>
            )}
          </div>

          <div className="form-section">
            <h2><FileText size={16} /> Audit</h2>
            <div className="form-row">
              <label>Alasan penambahan *</label>
              <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} required placeholder="Minimal 3 karakter" />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={() => router.push("/sppg")}>Batal</button>
            <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan SPPG"}</button>
          </div>
        </form>
      </section>
    </main>
    </>
  );
}
