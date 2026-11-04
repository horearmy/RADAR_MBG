# RADAR MBG — Review Aplikasi Lengkap (2026-11)

Dokumen ini adalah hasil review menyeluruh terhadap codebase RADAR MBG pada branch `feat/multi-tenant-foundation` (HEAD `ee62814` + perubahan lokal belum di-commit). Tujuan: memberikan gambaran terkini arsitektur, fitur, kualitas, celah, dan rekomendasi, serta menjadi acuan dokumentasi terbaru.

## 1. Ringkasan Eksekutif

- **Status rilis:** Belum siap produksi. Fondasi backend solid (auth, RBAC, trip lifecycle, GPS, geofence, POD, exception, audit), tetapi banyak fitur tenant/recipients masih partial dan pengujian end-to-end pada database hidup belum dijalankan.
- **Frontend:** Next.js 16 App Router, dua workspace (Control Tower web + Tenant portal + Driver PWA + Recipient PWA). Typecheck lulus; lint memiliki 195 masalah di `src` (86 error, 109 warning), sebagian besar `no-unused-vars`/`no-explicit-any` dan pelanggaran hooks React 19.
- **Backend:** NestJS 12 + Prisma 6 + PostgreSQL 18.6/PostGIS 3.6.2. Build & lint lulus; 17 test files / 58 unit test lulus. Database lokal up-to-date (17 migrasi).
- **Multi-tenant:** Fondasi tenant sudah ditambahkan (`Tenant`, `TenantMembership`, `SppgProfile`, `TenantRegistration`, `RegistrationDocument`, `TenantApproval`) dan guard/context resolver. Namun isolasi lintas tenant belum diuji (e2e cross-tenant masih placeholder).
- **Risiko utama:** IDOR/BOLA lintas SPPG/tenant belum diverifikasi; lint frontend bermasalah; beberapa fitur (recipient, GPS lifecycle, notifikasi, offline queue) hanya UI dummy; MinIO tidak tersedia di lingkungan lokal.

## 2. Stack & Arsitektur

| Lapisan | Teknologi |
|---|---|
| Frontend | Next.js 16.4.3 (App Router), React 19.3, TypeScript 5, Tailwind 4, MapLibre 6.16, Leaflet |
| Backend | NestJS 12, Node 20+, TypeScript 6, Prisma 6.19, Express |
| Database | PostgreSQL 18.6 + PostGIS 3.6.2 (lokal) |
| Storage | MinIO (S3-compatible), bucket `radar-mbg-pod` (privat) |
| Auth | Argon2id, HttpOnly session cookie, CSRF, TOTP MFA, recovery/rotation |
| Observability | Health endpoint; alert worker (exception) opsional |

**Pola arsitektur:**
- Web Control Tower + Driver PWA + Recipient PWA dalam satu aplikasi Next.js.
- Backend modular (NestJS) dengan prefix `/api/v1`, validasi global, security headers (helmet), CORS allowlist, CSRF middleware.
- Server adalah sumber otoritatif untuk izin, verifikasi, dan transisi trip.
- Data GPS disimpan terpisah dari waktu server; freshness ditandai `LIVE/STALE/OFFLINE`.

## 3. Struktur Repository

```
RADAR MBG/
├── api/                      # Backend NestJS
│   ├── prisma/               # schema, migrasi, seed, bootstrap
│   ├── src/                  # modul backend
│   └── test/                 # e2e tests
├── src/                      # Frontend Next.js
│   ├── app/                  # routes/pages
│   ├── components/
│   └── lib/
├── docs/                     # dokumentasi
├── public/                   # aset PWA
├── scripts/                  # utilitas
├── docker-compose.yml
├── package.json              # scripts gabungan
└── (leftover) radar-mbg/, radar-mbg-backend/, radar-mbg-web/  # artefak lama, kandidat cleanup
```

**Catatan:** Terdapat direktori sisa `radar-mbg` (snapshot lama), `radar-mbg-backend` (hanya dist/node_modules), dan `radar-mbg-web` (scaffold kosong). Disarankan dibersihkan agar tidak membingungkan.

## 4. Domain & Data Model

48 model Prisma, mencakup:
- **Hierarki & tenant:** `Organization`, `Region`, `Sppg`, `Tenant`, `TenantMembership`, `SppgProfile`.
- **Identitas & akses:** `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Session`, `AccountAccessToken`, `MfaRecoveryCode`.
- **Master data:** `Driver`, `Vehicle`, `DriverVehicleAssignment`, `DeliveryLocation`.
- **Trip & tracking:** `Trip`, `GpsPosition`, `TripEvent`, `Geofence`, `Route`, `QrToken`, `ArrivalVerification`, `ArrivalOverride`.
- **Delivery/POD:** `DeliveryRecord`, `ProofOfDelivery`, `DeliveryAdjustment`.
- **Exception & audit:** `ExceptionCase`, `ExceptionEvent`, `AuditLog`, `ApprovalRequest`, `ApprovalDecision`.
- **Tenant lifecycle:** `TenantRegistration`, `RegistrationDocument`, `TenantApproval`.
- **Recipient (baru):** `RecipientOrganization`, `RecipientSite`, `RecipientMembership`, `DeliveryStop`, `DeliveryAssignment`.
- **Infra:** `login_rate_limits`, `worker_leases`, `LocationEvent`, `GeofenceEvent`, `NotificationEvent`.

**Migrasi:** 17 migrasi, status up-to-date terhadap DB lokal. Trigger append-only audit, rate limit lintas instance, dan lease worker terpasang.

## 5. Backend — Modul & API

Modul terdaftar di `api/src/app.module.ts`: Database, Auth, Trip, Admin, Exception, Alert, Tenant, Registration, Platform.

### 5.1 Auth (`api/src/auth`)
- Login Argon2id, session cookie HttpOnly, logout/revoke.
- CSRF middleware (`createCsrfMiddleware`), origin check.
- MFA: enrollment TOTP, konfirmasi, rotasi (secret pending terenkripsi 10 menit), recovery admin-terbit 30 menit, kode pemulihan 10x (hash).
- Rate limit login atomik di PostgreSQL (`login_rate_limits`) per IP dan IP/identitas; fail-closed bila DB tidak tersedia.
- Guard: `SessionGuard`, `PermissionGuard`, `TenantGuard`, `PlatformGuard`.

### 5.2 Master Data (`api/src/admin/master-data`)
- CRUD organisasi, wilayah, SPPG, lokasi tujuan, kendaraan, pengemudi.
- Scope org/region/SPPG; audit before/after; SPPG optimistic version.
- Riwayat assignment driver–kendaraan dengan deteksi bentrok (transaksi Serializable).

### 5.3 Trip (`api/src/trips`)
- Create draft, list/detail scoped, schedule, ready-to-depart, start, cancel.
- Reschedule, reassignment, perubahan tujuan (sebelum berangkat).
- GPS ingestion (`POST /locations`) idempoten, flag akurasi buruk/data lama/out-of-order/replay/lompatan.
- Track historis dengan batas rentang & jumlah titik.
- Geofence circle (create/list, versi, audit).
- QR token dinamis (hash, one-time, expiry, revoke token sebelumnya).
- Arrival verify & override manual (`arrival:override`).
- Delivery: start, submit POD, review (reviewer terpisah), proof upload (multipart, hash SHA-256, dedup, signed URL 5 menit).
- Complete (gate rekonsiliasi diterima).

### 5.4 Exception (`api/src/exceptions`)
- Create/list/detail, triage, assign, investigate, resolve, escalate, close.
- Filter status/severity/source/assignedToMe, pencarian, pagination.
- Assignee list scoped (`GET /exceptions/assignees`).

### 5.5 Alert Worker (`api/src/alerts`)
- Terjadwal, default nonaktif (`ALERT_WORKER_ENABLED`).
- Scan keterlambatan, GPS stale/offline (update `trackingStatus`), QR failure, selisih POD, POD belum direview.
- Dedupe key + cooldown + audit (aktor sistem null).
- Lease PostgreSQL anti-concurrency lintas instance.

### 5.6 Tenant (`api/src/tenant`)
- Summary, me, profile, delivery locations, trips, drivers, vehicles, users, invitations.
- Tenant context resolver + guard.
- Bulk role/status, invitation accept.

### 5.7 Registration (`api/src/registration`)
- Tenant registration flow (controller ada; detail di service).

### 5.8 Platform (`api/src/platform`)
- List tenants, summary, geofences (superadmin).

### 5.9 Storage (`api/src/storage`)
- S3/MinIO client, signed URL.

### 5.10 Audit (`api/src/admin/audit`)
- Read-only, filter aksi/entitas/tanggal, pagination, identitas aktor, before/after, scope.

## 6. Frontend — Routes & Fitur

### 6.1 Control Tower (web)
- `/` dashboard KPI, trip hari ini, exception, posisi GPS terakhir, MapLibre + OSM tile.
- `/trips`, `/trips/[id]` (detail, peta, timeline, POD, exception, aksi).
- `/exceptions` (filter, pagination, tindak lanjut).
- `/approvals`, `/audit`, `/reporting`.
- `/users`, `/vehicles`, `/drivers`, `/sppg`, `/geofences`.
- `/register`, `/register/status`.

### 6.2 Tenant Portal
- `/tenant`, `/tenant/trips`, `/tenant/drivers`, `/tenant/vehicles`, `/tenant/users`, `/tenant/audit`, `/tenant/profile`, `/tenant/map`, `/tenant/recipients`.

### 6.3 Driver PWA
- `/driver` (tugas, start, GPS, QR kamera/fallback token, POD, bukti).
- `/driver/login`.
- Service worker (`public/sw.js`), manifest, offline fallback.

### 6.4 Recipient PWA
- `/radarapp`, `/radarapp/recipient`, `/radarapp/login`.

### 6.5 Admin/Security
- `/security/mfa`, `/security/mfa/recovery`.
- `/account-access`, `/acceptinvitation`.
- `/login`.

## 7. Auth, RBAC, Multi-tenant

- **Role katalog** (seed idempoten): SUPERADMIN (global, MFA wajib), APPROVER, SPPG_ADMIN, DISPATCHER, DRIVER, AUDITOR, LEADER.
- **Permission:** 33 kode (lihat `rbac-catalog.ts`).
- **Tenant role:** `TENANT_ADMIN`, `TENANT_OPERATOR`, `TENANT_DRIVER`, `TENANT_VIEWER` dengan permission mapping di `permissions.ts`.
- **Scope:** org/region/SPPG via `UserRole`; tenant via `TenantMembership`.
- **Multi-tenant:** Tenant models + guard + context resolver ditambahkan; platform controller untuk superadmin. Namun isolasi belum diuji e2e.

## 8. Keamanan

**Sudah ada:**
- Argon2id, session hash token, CSRF global, CORS allowlist, helmet.
- MFA TOTP + recovery + rotation dengan enkripsi secret.
- Rate limit login atomik PostgreSQL.
- Audit append-only (trigger DB).
- Signed URL POD 5 menit, bucket privat.
- Permission guard + scope check; resource lookup ter-scope (404 generik).

**Celah/risiko:**
- IDOR/BOLA lintas SPPG/tenant belum diuji (cross-tenant e2e masih placeholder).
- `report:read` permission ada di RBAC catalog? Tidak tercantum di `PERMISSION_CODES` (rbac-catalog.ts) tetapi dipakai di `TENANT_ROLE_PERMISSIONS` — potensi mismatch.
- Frontend lint error (hooks rules) bisa menyebabkan bug runtime (cascading render).
- Belum ada CSP untuk tile OSM.
- Belum ada secret manager/rotasi secret formal.
- `cookies.txt`, `csrf.json` ada di root (artefak debugging) — pastikan tidak ter-commit ke produksi.

## 9. Kualitas & Testing

| Pemeriksaan | Hasil |
|---|---|
| Frontend typecheck (`tsc --noEmit`) | ✅ Lulus |
| Frontend lint (`eslint src`) | ❌ 195 masalah (86 error, 109 warning) |
| Frontend build (`next build`) | ❌ Gagal saat prerender (useParams di client component tanpa Suspense; route `/sppg/[id]/edit` dan `/drivers`) |
| Backend build (`nest build`) | ✅ Lulus |
| Backend lint (`oxlint`) | ✅ Hanya warning minor |
| Backend unit tests (vitest) | ✅ 17 files / 58 tests lulus |
| Backend e2e | Hanya smoke (auth/csrf/health) + cross-tenant placeholder |
| DB migrate status | ✅ Up-to-date (17 migrasi) |

**Gap pengujian:**
- Tidak ada test integrasi terhadap PostgreSQL hidup untuk trip lifecycle, GPS, geofence, POD.
- Cross-tenant isolation e2e masih placeholder.
- IDOR/BOLA tests belum ada.
- Aksesibilitas & device testing (mobile) belum dilakukan.

## 10. Celah & Risiko (Klasifikasi)

**Blocker (P0):**
1. Production build (`next build`) gagal saat prerender karena `useParams()` di client component tanpa `<Suspense>` (route `/sppg/[id]/edit`, `/drivers`) — rilis terblokir.
2. IDOR/BOLA lintas SPPG/tenant belum diverifikasi — risiko kebocoran data.
3. Lint frontend error (hooks) — risiko bug runtime; harus dibersihkan sebelum rilis.
4. Recipient data masih dummy (tidak terhubung API) - fitur tidak fungsional.
5. GPS lifecycle tracking belum lengkap (hanya status indicator).
6. MinIO tidak tersedia di lingkungan lokal → upload POD belum diuji.

**Should-fix (P1):**
1. Notifikasi (outbox/delivery) belum diimplementasi (UI only).
2. Offline queue PWA (GPS/POD/bukti) belum ada.
3. ETA belum diimplementasi.
4. Route plan/version, corridor deviation belum ada.
5. Laporan/ekspor belum ada.
6. `report:read` permission mismatch (lihat §8).

**Nit:**
1. Artefak sisa direktori `radar-mbg*`.
2. File debugging `cookies.txt`, `csrf.json` di root.
3. `no-unused-vars` banyak di komponen.

## 11. Rekomendasi Prioritas

1. **Keamanan:** Tambahkan test IDOR/BOLA & cross-tenant e2e; verifikasi scope di semua endpoint (termasuk tenant & platform).
2. **Kualitas frontend:** Bersihkan lint error (terutama hooks `set-state-in-effect`, `no-explicit-any`); jalankan `next build`.
3. **Integrasi:** Hubungkan recipient ke API; implementasi GPS lifecycle & offline queue.
4. **Infra lokal:** Jalankan Docker (PostgreSQL + MinIO) dan uji flow POD end-to-end.
5. **Dokumentasi:** Update `CURRENT_STATE_AUDIT.md` yang sudah usang; konsolidasikan TODO ke satu backlog.
6. **Cleanup:** Hapus direktori sisa & file debugging; pastikan `.gitignore` menutupi artefak.

## 12. Gerbang Rilis (Checklist)

- [ ] Semua acceptance criteria P0 PRD lulus atau pengecualian risiko tertulis.
- [ ] Semua migrasi diuji dari DB kosong + prosedur rollback.
- [ ] Uji isolasi org/region/SPPG/tenant lulus (API, GPS, file POD, realtime).
- [ ] MFA, sesi, CSRF, rate limit, idempotency, state machine, audit terbukti lewat test.
- [ ] Tidak ada kerentanan kritis/tinggi tanpa persetujuan risiko formal.
- [ ] Lint frontend 0 error; build lulus.
- [ ] UAT/pilot & persetujuan Product Owner terdokumentasi.

---

**Sumber rujukan:** `README.md`, `CURRENT_STATE_AUDIT.md`, `docs/IMPLEMENTATION_TODO.md`, `docs/FIELD_APP_FULL_REVIEW.md`, `api/prisma/schema.prisma`, `api/prisma/rbac-catalog.ts`, `api/src/auth/permissions.ts`.  
**Dibuat:** 2026-11-01.
