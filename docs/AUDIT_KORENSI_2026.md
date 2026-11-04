# 🔍 AUDIT KORENSI & ALUR DATA — RADAR MBG

**Tanggal:** 3 November 2026
**Ruang lingkup:** Platform utama (`/`), Tenant workspace (`/tenant/*`), Field App (`/radarapp/*`)
**Metode:** Eksplorasi kode mendalam + verifikasi silang backend/frontend

---

## 📊 RINGKASAN EKSEKUTIF

### Apakah koensi sudah baik?

**Belum.** Terdapat **12 masalah kritis**, **20+ masalah tinggi**, dan **banyak masalah sedang** yang menyebabkan:

| Area | Koensi | Status |
|------|--------|--------|
| **Platform** (`/`) | ❌ | Auth bypass, endpoint hilang, route rusak |
| **Tenant** (`/tenant/*`) | ❌ | Double shell, tanpa permission guard, data mismatch |
| **Radarapp** (`/radarapp/*`) | ❌ | Navigasi mati, recipient kosong, race condition |

### Prioritas Perbaikan

| Prioritas | Jumlah | Dampak |
|-----------|--------|--------|
| 🔴 **KRITIS** | 12 | Fitur rusak total, auth bypass, data hilang |
| 🟠 **TINGGI** | 20+ | Race condition, privacy, error handling |
| 🟡 **SEDANG** | 30+ | Dead code, inkonsistensi, hardcoded values |

---

## 🔴 MASALAH KRITIS (Perlu Diperbaiki Segera)

### 1. Auth Bypass di Platform Page — `src/app/page.tsx:243-256`

**Masalah:** Saat `getCurrentSession()` gagal (401/403/network), sistem **tidak redirect ke login** tapi menggunakan `mockUser` hardcoded:

```tsx
// Cara 2: Gunakan mock user rather than redirect untuk testing
user = mockUser;
setSessionState("ready");
setSessionUser(user);
await loadDashboard(user, true);
```

**Dampak:**
- Siapa pun bisa membuka `/` tanpa login
- Dashboard tampil dengan data kosong (mockUser tidak punya permission)
- Error state `unavailable` tidak pernah tercapai (dead code)

**Perbaikan:**
```tsx
if (error instanceof Error && error.message === "UNAUTHENTICATED") {
  router.replace("/login?expired=1");
  return;
}
setSessionState("unavailable");
```

---

### 2. Navigation Coordinates Tidak Pernah Di-return Backend — `api/src/trips/trip.service.ts:96`

**Masalah:** `TripSummary` di frontend punya `deliveryLocation.latitude/longitude`, tapi backend tidak select:

```ts
deliveryLocation: { select: { id: true, code: true, name: true } },
// ❌ Tidak ada latitude/longitude
```

**Dampak:**
- Tombol "Navigasi" di trip card **tidak pernah muncul**
- Tab Navigasi selalu menampilkan "Lokasi tujuan tidak tersedia"
- Fitur navigasi **tidak berfungsi end-to-end**

**Perbaikan:**
```ts
deliveryLocation: { select: { id: true, code: true, name: true, latitude: true, longitude: true } },
```

---

### 3. Recipient Data Tidak Pernah Dibuat — `api/src/`

**Masalah:** Tidak ada `deliveryStop.create` atau `notificationEvent.create` di seluruh backend. Grepping mengkonfirmasi **nol hasil**.

**Dampak:**
- `GET /recipient/deliveries` **selalu返回 []**
- `GET /recipient/notifications` **selalu返回 []**
- `getPod` **selalu 404**
- Halaman recipient adalah **shell kosong**

**Perbaikan:** Implementasi pembuatan `DeliveryStop` saat trip dibuat/diassign, dan `NotificationEvent` saat status berubah.

---

### 4. Recipient Status Tidak Teretap — `src/lib/field-status.ts`

**Masalah:** `DeliveryStop.status` default `"PENDING"`, tapi `statusMeta` tidak punya entry untuk `PENDING` atau `CONFIRMED`:

```ts
// field-status.ts tidak punya:
// case "PENDING": ...
// case "CONFIRMED": ...
```

**Dampak:**
- Semua delivery card menampilkan **"Status tidak diketahui"**
- Semua filter tab kosong (PENDING tidak masuk filter manapun)
- Setelah `confirm` → status `CONFIRMED` → **hilang dari semua filter**

**Perbaikan:** Tambah mapping `PENDING` → "Menunggu", `CONFIRMED` → "Dikonfirmasi".

---

### 5. Double Layout Shell di Semua Tenant Pages

**Masalah:** `src/app/tenant/layout.tsx` membungkus children dengan `app-shell + TenantSidebar + main-column + topbar`, tapi **setiap halaman tenant juga merender struktur yang sama**:

```tsx
// layout.tsx
<div className="app-shell">
  <TenantSidebar />
  <section className="main-column">...</section>
</div>

// trips/page.tsx (juga)
<div className="app-shell">
  <TenantSidebar />
  <section className="main-column">...</section>
</div>
```

**Dampak:**
- **Dua sidebar** yang overlap (fixed position)
- **Dua topbar** sticky
- Konten ter-indent ~492px (harusnya 246px)

**Perbaikan:** Hapus wrapper dari layout, biarkan halaman yang render shell.

---

### 6. Tidak Ada Permission Enforcement di Backend Tenant — `api/src/tenant/tenant.controller.ts`

**Masalah:** Semua endpoint `/tenant/*` hanya pakai `@UseGuards(SessionGuard, TenantGuard)`, **tanpa `@RequirePermissions`**.

**Dampak:**
- `TENANT_DRIVER` bisa `POST /tenant/users` (create admin)
- `TENANT_VIEWER` bisa `PATCH /tenant/profile`
- Semua mutation terbuka untuk semua tenant member

**Perbaikan:** Tambah `@RequirePermissions` di setiap mutation endpoint.

---

### 7. Recipient Notification Tidak Bisa Deep-link — `api/src/recipient/recipient.service.ts:205-206`

**Masalah:** `listNotifications` hardcode `tripReference: null, stopId: null`.

**Dampak:** Klik notifikasi tidak pernah membuka delivery yang benar.

---

### 8. Recipient Background Refresh Mengganti UI dengan "unavailable"

**Masalah:** `recipient-client.tsx:154-156` — `isApiUnavailable` dipanggil untuk **semua** load (initial + background).

**Dampak:** 404/501 sesaat saat polling 60 detik → UI hilang, diganti "Layanan penerima belum tersedia".

---

### 9. `DriverNavigation` Refetch Storm

**Masalah:**
- `origin` update tiap GPS fix → effect re-run
- `destination` objek baru tiap render → effect re-run
- Tidak ada throttle/debounce

**Dampak:** OSRM di-fetch terus-menerus, `fitBounds` terus-menerus, peta bergetar.

---

### 10. Missing `maplibregl.setWorkerUrl` di Navigation Map

**Masalah:** `fleet-map.tsx` set worker URL, `driver-navigation.tsx` tidak.

**Dampak:** Potensi kegagalan render map/worker.

---

### 11. Unhandled `import("maplibre-gl")` Rejections

**Masalah:** 4 dynamic imports tanpa `.catch()`.

**Dampak:** Unhandled promise rejection, blank map.

---

### 12. Hardcoded Third-Party Services (Privacy)

**Masalah:**
- OSM tiles: `https://tile.openstreetmap.org/...`
- Routing: `https://router.project-osrm.org/...`
- GPS koordinat driver dikirim ke server pihak ketiga

**Dampak:** Privasi driver terancam, rate limit OSRM.

---

## 🟠 MASALAH TINGGI (Perlu Diperbaiki)

### 13. 403-vs-401 Mismatch

**Masalah:** `SessionGuard` return `false` → NestJS **403**, bukan 401. Tapi `api.ts` hanya map 401 → `UNAUTHENTICATED`.

**Dampak:** Redirect login di platform page **dead code**.

---

### 14. Missing `plannedArrivalAt` di `listTrips`

**Masalah:** `tenant.service.ts:243-255` tidak select `plannedArrivalAt`.

**Dampak:**
- Kolom ETA di trips page **selalu `--:--`**
- Deteksi keterlambatan **tidak pernah aktif**

---

### 15. Missing Delivery-Location Coordinates

**Masalah:** `listDeliveryLocations` hanya select `{ id, code, name }`.

**Dampak:**
- Map detail panel selalu "Alamat tidak tersedia"
- Origin marker **selalu null**
- Geofence center **tidak pernah pre-fill**

---

### 16. Missing `driver` di `listUsers`

**Masalah:** `listUsers` hanya select `user: { id, username, displayName, status }`.

**Dampak:** Kolom DRIVER di users table **selalu "—"**.

---

### 17. `admin:manage_users` Permission Gap

**Masalah:** Permission ini tidak ada di `TENANT_ROLE_PERMISSIONS` (frontend) maupun backend tenant map.

**Dampak:** "Pengguna" quick link & "Buat akun login" button **tidak pernah muncul** untuk tenant admin.

---

### 18. Race Condition: `loadDetail`

**Masalah:** Tidak ada request-id guard. Buka trip A lalu B → response terakhir menang.

**Dampak:** Detail dialog bisa menampilkan data salah.

---

### 19. Race Condition: `loadTrips`

**Masalah:** 45s interval + manual refresh + action → bisa overlap.

**Dampak:** Response lama bisa menimpa data baru.

---

### 20. Recipient Background Failures Silent

**Masalah:** Non-initial failure (bukan 401/404/501) **tidak set apa-apa**.

**Dampak:** User tidak tahu ada error.

---

## 🟡 MASALAH SEDANG (Perlu Dibersihkan)

### 21. Endpoint `/platform/dashboard-summary` Tidak Ada

**Dampak:** Governance panel tidak pernah render.

---

### 22. Route `/tenants` Tidak Ada (Broken Links)

**Dampak:** 4 link rusak di platform page + sidebar.

---

### 23. `account-menu.tsx` Pakai API Base Berbeda

**Masalah:** Hardcoded `localhost:4000` bukan `/api/v1` proxy.

---

### 24. Dead Code di Map Page

- `createGeofence` import tidak dipakai
- `mapDeliveryLocation`/`LocationOption` tidak dipakai
- `sppgName` state tidak di-render
- `canManageGeofence` tidak dipakai
- `drawPolygon` tidak pernah `true`
- `searchRouteCoords` selalu `null`

---

### 25. Inconsistent Metrics

- `summary.tripsDone` = DELIVERED + COMPLETED
- Trips page = hanya COMPLETED
- `summary.tripsToday` pakai server-local midnight, bukan WIB

---

### 26. Audit Page Tanpa Session Check

**Masalah:** `/tenant/audit` tidak panggil `getCurrentSession`.

---

### 27. Unused Imports

- `driver-client.tsx`: `readyTrip`, `WORKSPACE_HOME`
- `users/page.tsx`: `KeyRound`
- `recipients/page.tsx`: `KeyRound`
- `profile/page.tsx`: `Save`

---

### 28. Hardcoded Values

- OSM tile URL, OSRM URL, map center
- GPS interval 20s, stale 90s, accuracy 50m
- Poll 45s/60s, history page 10
- Test credentials di dokumentasi

---

## 📋 MATRIKS KOENSI PER FITUR

| Fitur | Platform | Tenant | Radarapp | Status |
|-------|----------|--------|----------|--------|
| **Login/Auth** | ❌ Bypass | ⚠️ Inconsistent | ✅ OK | 🔴 |
| **Dashboard Data** | ⚠️ Mock fallback | ⚠️ Missing fields | ✅ OK | 🟠 |
| **Trip List** | ✅ OK | ⚠️ Missing ETA | ✅ OK | 🟡 |
| **Trip Detail** | ✅ OK | ❌ No detail page | ⚠️ Race | 🟠 |
| **Trip Creation** | N/A | ⚠️ Errors not mapped | N/A | 🟡 |
| **Driver Management** | N/A | ⚠️ Permission gap | N/A | 🟠 |
| **Vehicle Management** | N/A | ⚠️ No 403 redirect | N/A | 🟡 |
| **User Management** | N/A | ⚠️ Driver col empty | N/A | 🟡 |
| **Profile** | N/A | ⚠️ Can't create | N/A | 🟡 |
| **Map/Geofence** | ✅ OK | ❌ Broken (no coords) | N/A | 🔴 |
| **Navigation** | N/A | N/A | ❌ Dead (no coords) | 🔴 |
| **Recipient** | N/A | N/A | ❌ Empty (no data) | 🔴 |
| **GPS Tracking** | N/A | N/A | ⚠️ sessionStorage | 🟠 |
| **POD** | N/A | N/A | ⚠️ No 401 redirect | 🟡 |
| **Notifications** | N/A | N/A | ❌ Always empty | 🔴 |

---

## 🎯 REKOMENDASI PERBAIKAN (Prioritas)

### Fase 1 — Perbaikan Kritis (1-2 hari)

1. **Hapus `mockUser` fallback** di `src/app/page.tsx:243-256`
2. **Tambah `latitude/longitude`** di `trip.service.ts:96` select
3. **Tambah `PENDING`/`CONFIRMED`** di `field-status.ts`
4. **Fix double shell** di `src/app/tenant/layout.tsx`
5. **Tambah `@RequirePermissions`** di `tenant.controller.ts`
6. **Fix `setWorkerUrl`** di `driver-navigation.tsx`
7. **Tambah `.catch()`** di dynamic imports
8. **Implementasi pembuatan `DeliveryStop`** di backend

### Fase 2 — Perbaikan Tinggi (3-5 hari)

9. Fix 403-vs-401 handling di semua halaman
10. Tambah `plannedArrivalAt` di `listTrips`
11. Tambah coordinates di `listDeliveryLocations`
12. Tambah `driver` di `listUsers`
13. Fix `admin:manage_users` permission
14. Tambah request-id guard di `loadDetail`/`loadTrips`
15. Fix recipient background refresh
16. Throttle `DriverNavigation` refetch
17. Self-host OSRM atau cache route

### Fase 3 — Pembersihan (1-2 hari)

18. Hapus dead code
19. Fix unused imports
20. Tambah endpoint `/platform/dashboard-summary`
21. Fix `/tenants` → `/tenant`
22. Align `account-menu.tsx` API base
23. Fix inconsistent metrics
24. Hapus credentials dari dokumentasi

---

## 🚧 KENDALA UTAMA

| Kendala | Dampak | Solusi |
|---------|--------|--------|
| **Backend belum lengkap** (Phases 0-5 TODO) | Recipient kosong, navigation mati | Implementasi delivery stop & notification creation |
| **Tidak ada global exception filter** | Error messages tidak friendly | Tambah `APP_FILTER` |
| **Tidak ada `middleware.ts`** | Auth checks client-side only | Tambah middleware atau server guard |
| **Tidak ada testing** | Regression tidak terdeteksi | Tambah unit + integration tests |
| **Dokumentasi API tidak lengkap** | Frontend guess-work | Tambah Swagger/OpenAPI |
| **Environment config terpisah** | CORS/proxy issues | Konsolidasi ke `.env` tunggal |

---

## 📝 KESIMPULAN

**Koensi aplikasi RADAR MBG belum baik.** Terdapat 12 masalah kritis yang menyebabkan fitur-fitur utama tidak berfungsi:

1. **Navigasi** mati karena coordinates tidak di-return
2. **Recipient** kosong karena data tidak pernah dibuat
3. **Auth** bisa di-bypass di platform page
4. **Tenant pages** punya double shell
5. **Backend** tidak enforce permissions

**Rekomendasi:** Fokus pada Fase 1 (perbaikan kritis) terlebih dahulu, terutama:
- Hapus mockUser bypass
- Fix navigation coordinates
- Implementasi recipient data creation
- Fix double shell

Setelah Fase 1 selesai, fitur-fitur utama akan berfungsi dan koensi akan meningkat signifikan.

---

*Dokumen ini dihasilkan dari audit kode menyeluruh pada 3 November 2026.*
