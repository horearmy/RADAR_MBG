# Review Aplikasi Multi-Tenant — RADAR MBG

## Ringkasan
Aplikasi telah dimigrasikan dari single-tenant ke multi-tenant (shared DB, tenant_id isolation) sesuai rencana V2. Fondasi backend dan UI tenant workspace tersedia.

## Yang sudah ada
- Schema additive: tenants, tenant_memberships, sppg_profiles, tenant_registrations, registration_documents, tenant_approvals.
- tenant_id pada tabel operasional (driver, vehicle, trip, route, exception) dengan NOT NULL (core).
- Tenant context resolver + guard terintegrasi ke session.
- RBAC + permission guard.
- Tenant endpoints: /tenant/me, summary, profile (GET/PATCH), users, invitations, accept, drivers, vehicles, trips.
- Public registration: create, add document metadata, status tracking.
- Superadmin review: approve/reject/request-revision.
- Platform summary endpoint.
- UI: /tenant (dashboard + sidebar), /tenant/profile, /tenant/users, /tenant/drivers, /tenant/vehicles, /tenant/trips, /register, /register/status, /sppg (panel registrasi + modal detail), /accept-invitation, /reporting.

## Yang masih kurang
- Negative cross-tenant tests (placeholder).
- Invitation set-password/token flow detail (sudah basic).
- Upload dokumen multipart (MinIO) belum terintegrasi.
- Suspended handling UI detail.
- Reporting advanced (filter, export).
- RLS (contoh SQL saja).
- Cutover & rollback (operasional).

## Catatan
- Typecheck frontend memiliki error pre-existing (AuditTimeline, location-picker map.current) yang tidak terkait perubahan multi-tenant.
- Backend typecheck & tests lulus.
- Geofence tenant_id tetap nullable (delivery geofences shared).

## Rekomendasi
- Implementasi test harness cross-tenant.
- Integrasi storage upload.
- Hardening (rate limit, audit).
- Cutover bertahap dengan backup & rollback.
