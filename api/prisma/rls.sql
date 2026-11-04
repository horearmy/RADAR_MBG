CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_tenant_isolation" ON "tenants"
  USING ("id" = app_current_tenant_id())
  WITH CHECK ("id" = app_current_tenant_id());

ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_memberships_tenant_isolation" ON "tenant_memberships"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "sppg_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sppg_profiles_tenant_isolation" ON "sppg_profiles"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "tenant_registrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_registrations_tenant_isolation" ON "tenant_registrations"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "registration_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registration_documents_tenant_isolation" ON "registration_documents"
  USING (EXISTS (
    SELECT 1 FROM "tenant_registrations" registration
    WHERE registration."id" = "registration_documents"."registration_id"
      AND registration."tenant_id" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "tenant_registrations" registration
    WHERE registration."id" = "registration_documents"."registration_id"
      AND registration."tenant_id" = app_current_tenant_id()
  ));

ALTER TABLE "tenant_approvals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_approvals_tenant_isolation" ON "tenant_approvals"
  USING (EXISTS (
    SELECT 1 FROM "tenant_registrations" registration
    WHERE registration."id" = "tenant_approvals"."registration_id"
      AND registration."tenant_id" = app_current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "tenant_registrations" registration
    WHERE registration."id" = "tenant_approvals"."registration_id"
      AND registration."tenant_id" = app_current_tenant_id()
  ));

ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_tenant_isolation" ON "drivers"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_tenant_isolation" ON "vehicles"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "delivery_locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_locations_tenant_isolation" ON "delivery_locations"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_tenant_isolation" ON "trips"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "geofences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofences_tenant_isolation" ON "geofences"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "routes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_tenant_isolation" ON "routes"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "exception_cases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exception_cases_tenant_isolation" ON "exception_cases"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  USING ("tenant_id" = app_current_tenant_id())
  WITH CHECK ("tenant_id" = app_current_tenant_id());
