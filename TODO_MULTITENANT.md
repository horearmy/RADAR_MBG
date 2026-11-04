# TODO Multi-Tenant V2

## P0
- [x] Audit repository & schema
- [x] MIGRATION_MAPPING.md
- [x] Additive schema (tenant tables + tenant_id nullable)
- [x] db push + validate
- [x] TenantContext type + resolver + guard
- [x] Pola tenant-scoping pada listTrips
- [x] Backfill script idempotent (dry-run -> apply)
- [x] Negative cross-tenant tests detail (placeholder + scenario list)
- [ ] Enforce tenant_id NOT NULL setelah backfill

## P1
- [ ] Tenant-scoping semua endpoint trips (get/create/assign/status)
- [ ] Tenant-scoping drivers, vehicles, delivery locations, geofences, routes, exceptions
- [ ] Admin SPPG workspace (profil, users, drivers, vehicles, trips)
- [ ] Invitation flow Operator/Driver
- [ ] Public registration + review + approval + provisioning
- [ ] Tenant suspended handling

## P2
- [ ] Reporting & cross-tenant analytics
- [ ] RLS / observability / hardening
- [ ] Cutover & rollback readiness
