# SECURITY_AUDIT_REPORT

## 1. Ringkasan
Audit keamanan read-only terhadap RADAR MBG multi-tenant. Fokus: tenant isolation, IDOR/BOLA, permission, CSRF, GPS privacy, recipient scope, dan upload.

## 2. Kontrol yang sudah baik

### 2.1 Autentikasi dan session
- Login menggunakan Argon2.
- Session disimpan di database dengan token hash.
- MFA wajib untuk role global yang `requiresMfa`.
- Rate limit login aktif.
- CSRF double-submit aktif untuk mutating request.
- Origin validation aktif.

### 2.2 Tenant isolation
- `TenantGuard` mewajibkan tenant context untuk endpoint tenant.
- Query data dibatasi dengan `tenantId`.
- Global admin memerlukan tenant context untuk endpoint tenant.
- `resolveScope` membatasi SPPG/driver/geofence per tenant.

### 2.3 Recipient isolation
- `RecipientService` memvalidasi membership aktif.
- Delivery stops dibatasi berdasarkan `recipientSiteId`.
- POD hanya dapat dibuka oleh membership yang sah.
- Confirm/report issue memvalidasi membership.

### 2.4 Geofence
- Geofence tenant tersimpan dengan `tenantId`.
- Geofence create memvalidasi lokasi dan scope.
- Cross-tenant delivery location ditolak.

### 2.5 Upload
- Upload menggunakan private storage.
- Metadata disimpan di database.
- Validasi MIME/size perlu diperiksa lebih lanjut.

## 3. Temuan dan risiko

### 3.1 IDOR/BOLA pada resource by ID
- Beberapa endpoint mengambil resource by ID lalu memvalidasi scope.
- Perlu memastikan semua endpoint by ID memvalidasi ownership/assignment.
- Contoh: trip, stop, POD, geofence, driver, vehicle.

### 3.2 Tenant context di Field App
- Driver/penerima harus mengirim `x-tenant-id`.
- Jika tidak, backend menolak akses.
- Frontend perlu memastikan tenant context selalu tersedia.

### 3.3 Superadmin access ke tenant
- Superadmin dapat masuk tenant workplace jika tenant context tersedia.
- Sudah ditambahkan audit `tenant.support_access`.
- Perlu monitoring dan pembatasan lebih lanjut.

### 3.4 GPS privacy
- GPS hanya boleh dikirim selama trip aktif.
- Tracking harus dihentikan saat trip selesai/dibatalkan.
- Retensi GPS perlu ditetapkan.
- Lokasi terakhir recipient harus diberi label “terakhir diperbarui”, bukan “live”.

### 3.5 Recipient registration
- QR publik dapat disalahgunakan.
- Perlu rate limit dan approval.
- Token aktivasi harus one-time dan berlaku terbatas.

### 3.6 Permission consistency
- Backend `hasPermission` dan frontend `hasPermission` harus selaras.
- Sudah diperbaiki untuk mempertimbangkan `tenantMemberships`.
- Perlu audit permission per role.

## 4. Rekomendasi perbaikan

1. Audit semua endpoint by ID untuk ownership/assignment.
2. Pastikan driver tidak memiliki `tenant:read` / `master:read`.
3. Pastikan tenant context selalu dikirim di Field App.
4. Audit superadmin access ke tenant.
5. Tambahkan rate limit pada public registration.
6. Tetapkan retensi GPS.
7. Tambahkan test cross-tenant dan cross-recipient-site.
8. Dokumentasikan scope resolver sebagai single source of truth.

## 5. Verifikasi IDOR/BOLA

### 5.1 Recipient
- `getStop`, `getPod`, `confirm`, `reportIssue` memvalidasi membership sebelum akses.
- Status: **aman untuk scope site**.

### 5.2 Master data
- `getDriver`, `createVehicle`, `createDriver` memvalidasi SPPG access.
- `countDrivers` diperbaiki agar scope global konsisten dengan list.
- Status: **aman dengan catatan perlu test by ID**.

### 5.3 Geofence
- `listForLocation` dan `create` memvalidasi lokasi dan tenant scope.
- Status: **aman**.

### 5.4 User admin
- Scope user admin perlu diaudit lebih lanjut untuk cross-tenant.
- Status: **perlu review**.

## 6. Kesimpulan
Keamanan dasar sudah cukup baik, tetapi perlu hardening pada permission, tenant context, dan akses resource by ID sebelum production.