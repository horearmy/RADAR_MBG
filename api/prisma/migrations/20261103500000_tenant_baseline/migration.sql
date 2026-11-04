DO $$
BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TenantRole" AS ENUM ('TENANT_ADMIN', 'TENANT_OPERATOR', 'TENANT_DRIVER', 'TENANT_VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID NOT NULL,
  "tenant_code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
  "activated_at" TIMESTAMPTZ(6),
  "suspended_at" TIMESTAMPTZ(6),
  "legacy_sppg_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tenant_memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "TenantRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "invited_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sppg_profiles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "sppg_name" VARCHAR(200) NOT NULL,
  "official_code" VARCHAR(100),
  "full_address" TEXT NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "contact_phone" VARCHAR(40),
  "profile_status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "capacity" INTEGER,
  "district_code" VARCHAR(20),
  "notes" VARCHAR(2000),
  "operational_hours" VARCHAR(80),
  "person_in_charge" VARCHAR(160),
  "province_code" VARCHAR(20),
  "regency_code" VARCHAR(20),
  "village_code" VARCHAR(20),
  CONSTRAINT "sppg_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tenant_registrations" (
  "id" UUID NOT NULL,
  "registration_number" VARCHAR(60) NOT NULL,
  "tenant_id" UUID,
  "sppg_name" VARCHAR(200) NOT NULL,
  "official_code" VARCHAR(100),
  "province_code" VARCHAR(20) NOT NULL,
  "regency_code" VARCHAR(20) NOT NULL,
  "district_code" VARCHAR(20) NOT NULL,
  "village_code" VARCHAR(20) NOT NULL,
  "full_address" TEXT NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "contact_name" VARCHAR(150) NOT NULL,
  "contact_email" VARCHAR(200) NOT NULL,
  "contact_phone" VARCHAR(40) NOT NULL,
  "status" "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
  "submitted_at" TIMESTAMPTZ(6),
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenant_registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "registration_documents" (
  "id" UUID NOT NULL,
  "registration_id" UUID NOT NULL,
  "object_key" VARCHAR(512) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "byte_size" BIGINT NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "uploaded_by" UUID,
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "registration_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tenant_approvals" (
  "id" UUID NOT NULL,
  "registration_id" UUID NOT NULL,
  "approver_id" UUID NOT NULL,
  "decision" VARCHAR(32) NOT NULL,
  "reason" VARCHAR(2000),
  "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_approvals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "delivery_locations" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "exception_cases" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;

ALTER TABLE "drivers" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "trips" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "routes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "exception_cases" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_tenant_code_key" ON "tenants"("tenant_code");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_legacy_sppg_id_key" ON "tenants"("legacy_sppg_id");
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_id_status_idx" ON "tenant_memberships"("user_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_memberships_tenant_id_status_idx" ON "tenant_memberships"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_memberships_tenant_id_role_status_idx" ON "tenant_memberships"("tenant_id", "role", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sppg_profiles_tenant_id_key" ON "sppg_profiles"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_registrations_registration_number_key" ON "tenant_registrations"("registration_number");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_memberships_tenant_id_fkey') THEN
    ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_memberships_user_id_fkey') THEN
    ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sppg_profiles_tenant_id_fkey') THEN
    ALTER TABLE "sppg_profiles" ADD CONSTRAINT "sppg_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_registrations_tenant_id_fkey') THEN
    ALTER TABLE "tenant_registrations" ADD CONSTRAINT "tenant_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registration_documents_registration_id_fkey') THEN
    ALTER TABLE "registration_documents" ADD CONSTRAINT "registration_documents_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "tenant_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_approvals_registration_id_fkey') THEN
    ALTER TABLE "tenant_approvals" ADD CONSTRAINT "tenant_approvals_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "tenant_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
