# CURRENT_STATE_AUDIT — RADAR MBG

## Stack
- Frontend: Next.js 16.4.3 (App Router), React 19, Tailwind 4, TypeScript
- Backend: NestJS 12 (TypeScript), Prisma 6, PostgreSQL 16 + PostGIS
- Storage: MinIO (S3-compatible)
- Auth: Session cookie (argon2), MFA, RBAC via Role/Permission/UserRole

## Data model (existing)
- Organization → Region → Sppg (hierarchical, org/region scoped)
- User (global), Session, Role, Permission, UserRole (membership-like via org/region/sppg)
- Driver, Vehicle, DriverVehicleAssignment, Trip, GpsPosition, TripEvent
- DeliveryLocation, Geofence, Route, QrToken, ArrivalVerification, DeliveryRecord, ProofOfDelivery
- ExceptionCase, AuditLog, ApprovalRequest/Decision
- Already has RBAC + approval + audit infrastructure.

## Multi-tenant gap vs V2 plan
- Tenant = SPPG today is modeled via Organization/Region/Sppg hierarchy, NOT isolated tenants.
- No `tenant_registrations`, `tenants`, `tenant_memberships` tables.
- No public registration flow, no provisioning idempotency, no tenant lifecycle statuses (pending_activation/active/suspended/inactive/archived) — SppgStatus exists (PENDING/ACTIVE/SUSPENDED/ARCHIVED) but no tenant concept.
- Cross-tenant isolation not enforced via tenant_id scoping (uses org/region/sppg filters).
- Superadmin platform role not clearly separated; roles are global via isGlobal.

## Key observations
- Schema is already rich; migration should be ADDITIVE (expand-and-contract).
- UserRole already acts as membership (userId+roleId+org/region/sppg) — can be evolved into tenant_memberships.
- AuditLog, ApprovalRequest already exist — reuse.
- MinIO storage exists — add tenant-scoped path prefix.

## Risks
- Existing queries rely on org/region/sppg filters; must migrate to tenant_id.
- Plate number unique globally (Vehicle.plateNumber @unique) — may conflict across tenants; review.
- Driver code unique per sppg — OK.
- Sppg code unique per org — review for global tenant code.

## Next steps
1. Finalize target ERD mapping Organization/Sppg → Tenant.
2. Create migration plan MIGRATION_MAPPING.md.
3. Additive migration: tenants, tenant_memberships, tenant_registrations, registration_documents, tenant_approvals.
4. Backfill, then enforce.
