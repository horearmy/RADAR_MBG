# MULTI_TENANT_CURRENT_STATE_AUDIT

## 1. Ringkasan

Aplikasi RADAR MBG saat ini sudah berbasis multi-tenant pada level data dan guard, namun masih ada gap pada scope, role resolution, dan konsistensi akses antara platform, tenant workplace, Field App, dan recipient.

Status working tree saat audit: terdapat perubahan lokal yang belum di-commit, termasuk perbaikan recipient membership activation, live location recipient, geofence, dan perbaikan akses halaman.

## 2. Repository dan framework

- Repository utama: `RADAR_MBG`
- Branch aktif: `feat/multi-tenant-foundation`
- Frontend: Next.js 16.4.3, React 19.3.0
- Backend: NestJS 12, Prisma 6.19.3
- Database: PostgreSQL + PostGIS
- API prefix: `/api/v1`
- Web origins diatur via `WEB_ORIGINS`

## 3. Modul backend

Modul yang terdaftar:
- Database
- Auth
- Trip
- Admin
- Exception
- Alert
- Tenant
- Registration
- Platform
- Recipient
- Dev

Endpoint publik/tenant/platform tersedia untuk SPPG registration, tenant management, recipient registration, dan platform monitoring.

## 4. Data tenant saat ini

Jumlah data saat audit:
- tenants: 16
- users: 14
- tenantMemberships: 20
- recipientMemberships: 1
- drivers: 6
- vehicles: 2
- trips: 5
- geofences: 13
- recipientSites: 1
- recipientRegistrations: 1

Tenant aktif sebagian besar berasal dari registrasi SPPG yang sudah diprovisi. Terdapat tenant demo dan data uji.

## 5. Model isolasi tenant

### 5.1 Tenant
- Model `Tenant` memiliki `tenantCode`, `name`, `status`, `legacySppgId`, `features`.
- Relasi ke `TenantMembership`, `TenantRegistration`, `SppgProfile`, `RecipientRegistrationCode`, `RecipientRegistrationRequest`.

### 5.2 TenantMembership
- Menghubungkan `User` dan `Tenant`.
- Memiliki `role`: `TENANT_ADMIN`, `TENANT_OPERATOR`, `TENANT_DRIVER`, `TENANT_VIEWER`.
- Memiliki `status`: `ACTIVE`, `INVITED`, `SUSPENDED`, `INACTIVE`.

### 5.3 User
- User dapat memiliki:
  - global role (mis. `SUPERADMIN`)
  - tenant memberships
  - recipient memberships
- User tidak menyimpan `tenantRole` global di session; role tenant berasal dari membership.

### 5.4 Driver
- Driver terhubung ke tenant melalui `tenantId`.
- User dapat terhubung ke Driver melalui relasi `driver`.
- Driver workspace di Field App ditentukan dari `driverId` atau role `TENANT_DRIVER`.

## 6. Auth dan session

### 6.1 Login
- Login menggunakan username/password.
- MFA wajib untuk role global yang `requiresMfa`.
- CSRF double-submit diterapkan.
- Rate limit login aktif.

### 6.2 Session
- Session disimpan di database.
- `resolveSession` memuat:
  - user
  - driver
  - tenantMemberships
  - roles
- `tenantRole` tidak diisi di session principal; frontend harus mempertimbangkan `tenantMemberships`.

### 6.3 Tenant context
- Tenant context diresolve dari `x-tenant-id`.
- `TenantGuard` mewajibkan tenant context untuk endpoint tenant.
- Global admin tanpa tenant context ditolak untuk endpoint yang `RequireTenant()`.

## 7. Role dan permission

### 7.1 Global role
- `SUPERADMIN` memiliki `isGlobal = true`.
- Dapat melihat data lintas tenant sesuai permission.

### 7.2 Tenant role
Permission tenant dipetakan di frontend melalui `TENANT_ROLE_PERMISSIONS`:
- `TENANT_ADMIN`
- `TENANT_OPERATOR`
- `TENANT_DRIVER`
- `TENANT_VIEWER`

### 7.3 Recipient
- Recipient bukan tenant user.
- Menggunakan `RecipientMembership`.
- Scope dibatasi per `recipient_site`.

## 8. Scope resolver

Backend memiliki `resolveScope` di `MasterDataSer`:
- global admin → scope global
- tenant user → scope dari tenant SPPG
- non-tenant → scope dari roles

Frontend `hasPermission` sudah diperbarui untuk mempertimbangkan `tenantMemberships`, bukan hanya `tenantRole`.

## 9. Frontend route dan workspace

### Platform
- `/`
- `/sppg`
- `/platform`
- `/users`
- `/geofences`

### Tenant
- `/tenant`
- `/tenant/users`
- `/tenant/drivers`
- `/tenant/vehicles`
- `/tenant/trips`
- `/tenant/recipients`
- `/tenant/recipient-registrations`
- `/tenant/map`
- `/tenant/profile`
- `/tenant/audit`

### Field App
- `/radarapp` (landing)
- `/radarapp/login`
- `/radarapp/driver`
- `/radarapp/recipient`
- `/radarapp/register`

## 10. Isolasi data yang sudah ada

### 10.1 SPPG
- `/admin/sppg` menggunakan scope tenant/global.
- Tenant hanya melihat SPPG miliknya.

### 10.2 Driver
- `/admin/drivers` dan `/admin/drivers/summary` menggunakan scope tenant/global.
- KPI driver diperbaiki agar global admin menghitung semua tenant.

### 10.3 Geofence
- Tenant geofence tersimpan dengan `tenantId`.
- Platform dapat melihat semua geofence aktif.
- Peta utama auto-fit ke geofence.

### 10.4 Recipient
- Recipient hanya melihat site membership-nya.
- `/recipient/me`, `/recipient/deliveries`, `/recipient/stops/:id` memvalidasi membership.

## 11. Gap yang ditemukan

### 11.1 Driver access
- Beberapa akun driver memiliki `tenant_memberships` role `TENANT_DRIVER`, tetapi tidak memiliki profil driver.
- Beberapa akun driver tidak memiliki permission tenant yang cukup untuk masuk tenant workplace.
- Driver seharusnya hanya menggunakan Field App, tetapi akses tenant workplace masih bisa terjadi pada halaman tertentu.

### 11.2 Tenant role resolution
- `SessionPrincipal.tenantRole` tidak diisi oleh `resolveSession`.
- Frontend harus mempertimbangkan `tenantMemberships`.
- Sudah diperbaiki di `hasPermission`, tetapi perlu audit menyeluruh.

### 11.3 Superadmin access
- Superadmin dapat masuk tenant workplace jika tenant context tersedia.
- Perlu audit dan logging untuk akses support.

### 11.4 Recipient membership activation
- Sebelumnya `consumeAccountToken` hanya mengaktifkan `tenantMembership`, bukan `recipientMembership`.
- Sudah diperbaiki: `recipientMembership` juga diaktifkan.

### 11.5 Live location recipient
- Recipient delivery response awalnya tidak menyertakan posisi GPS terakhir.
- Sudah diperbaiki: `lastLatitude`, `lastLongitude`, `lastLocationAt`, `lastLocationAccuracy`.

### 11.6 Recipient registration
- Fondasi dan UI Phase 1/2 sudah dibuat.
- Field App registration page sudah tersedia.
- Masih perlu hardening dan end-to-end test.

## 12. Risiko

1. Cross-tenant data leakage jika scope tidak konsisten.
2. Driver dapat masuk tenant workplace jika permission terlalu longgar.
3. Superadmin access ke tenant tanpa audit.
4. Recipient site tidak terisolasi jika membership tidak divalidasi.
5. GPS privacy jika tracking di luar trip aktif.
6. Token invitation/registration bocor jika tidak one-time/expired.

## 13. Rekomendasi

1. Lakukan audit permission per role.
2. Pastikan driver tidak memiliki `tenant:read` / `master:read`.
3. Pastikan tenant context selalu dikirim di frontend.
4. Audit semua akses superadmin ke tenant.
5. Tambahkan test cross-tenant dan cross-recipient-site.
6. Dokumentasikan scope resolver sebagai single source of truth.
7. Lakukan hardening sebelum production.

## 14. Status saat audit

- Multi-tenant sudah berjalan pada level data dan guard.
- Isolasi tenant sebagian besar sudah ada.
- Masih ada gap pada role resolution, driver access, dan superadmin support access.
- Perlu Phase 1 hardening sebelum production.