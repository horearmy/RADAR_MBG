# MIGRATION_MAPPING — RADAR MBG (Draft)

## 1. Tenant model mapping
- 1 SPPG (existing) → 1 Tenant.
- Tenant root key: reuse Sppg.id as tenant_id (stabil, tidak mengubah PK/relasi) ATAU buat tenants.id baru dengan mapping table. Rekomendasi: buat `tenants` table baru, simpan `legacy_sppg_id → tenant_id` di migration map; operasional table tambah `tenant_id` nullable dulu.

## 2. Table mapping (existing → target)
| Existing | Target tenant-scoped | Catatan |
|---|---|---|
| Organization | tenants (platform/root) | Satu org = platform; tenant per SPPG |
| Region | region (tenant-scoped via org) | tetap org-scoped master data |
| Sppg | sppg_profiles (tenant-owned) | 1:1 dengan tenants |
| User | users (global, unchanged) | identitas global |
| UserRole | tenant_memberships | evolve: tambah tenant_id, role, status |
| Driver | drivers + tenant_id | tetap sppg-scoped, tambah tenant_id |
| Vehicle | vehicles + tenant_id | plate unique per tenant? review |
| Trip | trips + tenant_id | sudah sppg/org; tambah tenant_id |
| Geofence | geofences + tenant_id | |
| DeliveryLocation | delivery_locations + tenant_id | |
| Route | routes + tenant_id | |
| ExceptionCase | exception_cases + tenant_id | |
| AuditLog | audit_logs + tenant_id (nullable) | |
| ApprovalRequest | approval_requests + tenant_id (nullable) | |

## 3. Tenant lifecycle mapping
- SppgStatus.PENDING → tenant pending_activation (after provisioning)
- SppgStatus.ACTIVE → tenant active
- SppgStatus.SUSPENDED → tenant suspended
- SppgStatus.ARCHIVED → tenant archived

## 4. Role mapping
- Global roles (isGlobal=true) → superadmin platform role.
- SPPG-scoped UserRole → tenant_admin / tenant_operator / tenant_driver / tenant_viewer berdasarkan Role.code.

## 5. Backfill strategy
1. Create tenants for each Sppg (idempotent by legacy_sppg_id).
2. Create sppg_profiles from Sppg.
3. Backfill tenant_id on all tenant-owned tables via sppg_id → tenant mapping.
4. Backfill tenant_memberships from UserRole where sppgId not null.
5. Orphan/ambiguous records → exception queue (manual review).

## 6. Permission matrix
Reuse existing Role/Permission; add platform permissions:
- platform.tenants.read, platform.tenants.manage
- platform.registrations.review, platform.registrations.provision
Tenant permissions: tenant.profile.read/update, tenant.users.manage, drivers.*, vehicles.*, trips.*, reports.export, audit.read.

## 7. Migration phases (additive)
- Phase A: create tenants, tenant_memberships, tenant_registrations, registration_documents, tenant_approvals; add nullable tenant_id + index to operasional tables.
- Phase B: backfill + validation report.
- Phase C: enforce NOT NULL + FK + tenant context in API.
- Phase D: UI workspace + public registration.

## 8. Open decisions
1. Satu user boleh multi-SPPG membership? Rekomendasi awal: satu aktif, skema support banyak.
2. Driver selalu user login? Rekomendasi: pisah profil driver dari akun; login dibuat saat perlu (sudah sesuai schema Driver.userId nullable).
3. Dokumen wajib registrasi & verifier: TBD kebijakan.
4. Perubahan profil sensitif perlu approval Superadmin? TBD.
5. Retensi dokumen/audit/lokasi: TBD.
6. Support/impersonation: tidak di tahap awal.
