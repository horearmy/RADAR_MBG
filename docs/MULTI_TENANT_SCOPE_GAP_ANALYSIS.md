# MULTI_TENANT_SCOPE_GAP_ANALYSIS

## 1. Ringkasan
Multi-tenant RADAR MBG sudah berjalan pada level data, tetapi masih ada gap pada role resolution, akses driver, akses superadmin ke tenant, dan konsistensi tenant context.

## 2. Gap utama

### Gap 1 — Driver dapat masuk tenant workplace
- Beberapa akun driver memiliki `tenant_memberships` role `TENANT_DRIVER`.
- Permission driver tidak seharusnya mencakup `tenant:read` atau `master:read`.
- Driver seharusnya hanya menggunakan Field App.

### Gap 2 — `tenantRole` tidak diisi di session
- `resolveSession` tidak mengisi `tenantRole`.
- Frontend harus mempertimbangkan `tenantMemberships`.
- `hasPermission` sudah diperbarui, tetapi perlu audit menyeluruh.

### Gap 3 — Superadmin access ke tenant
- Superadmin dapat masuk tenant workplace jika tenant context tersedia.
- Perlu audit dan logging.

### Gap 4 — Tenant context di Field App
- Driver/penerima harus mengirim `x-tenant-id`.
- Jika tidak, backend menolak akses tenant.

### Gap 5 — Recipient membership activation
- Sebelumnya `consumeAccountToken` hanya mengaktifkan `tenantMembership`.
- Sudah diperbaiki: `recipientMembership` juga diaktifkan.

### Gap 6 — Live location recipient
- Recipient delivery response awalnya tidak menyertakan posisi GPS terakhir.
- Sudah diperbaiki.

### Gap 7 — Recipient registration
- Fondasi dan UI Phase 1/2 sudah dibuat.
- Masih perlu hardening dan end-to-end test.

## 3. Risiko
1. Cross-tenant data leakage.
2. Driver masuk tenant workplace.
3. Superadmin access tanpa audit.
4. Recipient site tidak terisolasi.
5. GPS privacy.
6. Token bocor.

## 4. Rekomendasi
1. Audit permission per role.
2. Pastikan driver tidak memiliki `tenant:read` / `master:read`.
3. Pastikan tenant context selalu dikirim.
4. Audit superadmin access.
5. Tambahkan test cross-tenant dan cross-recipient-site.
6. Dokumentasikan scope resolver.
7. Hardening sebelum production.