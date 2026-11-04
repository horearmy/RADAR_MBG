CREATE SCHEMA IF NOT EXISTS "public";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "SppgStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'EXECUTED', 'EXPIRED', 'CANCELLED', 'FAILED');

CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sppgs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(500),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "coordinates" geography(Point, 4326),
    "status" "SppgStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "sppgs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sppgs_latitude_range_check" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
    CONSTRAINT "sppgs_longitude_range_check" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
    CONSTRAINT "sppgs_coordinate_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254),
    "display_name" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'INVITED',
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_encrypted" VARCHAR(512),
    "password_changed_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "disabled_at" TIMESTAMPTZ(6),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "requires_mfa" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "organization_id" UUID,
    "region_id" UUID,
    "sppg_id" UUID,
    "assigned_by" UUID,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_roles_validity_check" CHECK ("effective_until" IS NULL OR "effective_until" > "effective_from"),
    CONSTRAINT "user_roles_single_scope_check" CHECK (num_nonnulls("organization_id", "region_id", "sppg_id") <= 1)
);

CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6),
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "payload_before" JSONB,
    "payload_after" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "object_version" INTEGER,
    "submitted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "executed_at" TIMESTAMPTZ(6),
    "correlation_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "decision" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(2000),
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "result" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(2000),
    "before" JSONB,
    "after" JSONB,
    "request_id" VARCHAR(100),
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");
CREATE INDEX "regions_organization_id_active_idx" ON "regions"("organization_id", "active");
CREATE UNIQUE INDEX "regions_organization_id_code_key" ON "regions"("organization_id", "code");
CREATE INDEX "sppgs_organization_id_status_idx" ON "sppgs"("organization_id", "status");
CREATE INDEX "sppgs_region_id_status_idx" ON "sppgs"("region_id", "status");
CREATE UNIQUE INDEX "sppgs_organization_id_code_key" ON "sppgs"("organization_id", "code");
CREATE INDEX "sppgs_coordinates_idx" ON "sppgs" USING GIST ("coordinates");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "user_roles_user_id_effective_until_idx" ON "user_roles"("user_id", "effective_until");
CREATE INDEX "user_roles_sppg_id_role_id_idx" ON "user_roles"("sppg_id", "role_id");
CREATE INDEX "user_roles_organization_id_region_id_idx" ON "user_roles"("organization_id", "region_id");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE INDEX "sessions_revoked_at_expires_at_idx" ON "sessions"("revoked_at", "expires_at");
CREATE INDEX "approval_requests_status_submitted_at_idx" ON "approval_requests"("status", "submitted_at");
CREATE INDEX "approval_requests_target_type_target_id_idx" ON "approval_requests"("target_type", "target_id");
CREATE INDEX "approval_requests_requested_by_created_at_idx" ON "approval_requests"("requested_by", "created_at");
CREATE INDEX "approval_decisions_approval_request_id_decided_at_idx" ON "approval_decisions"("approval_request_id", "decided_at");
CREATE INDEX "approval_decisions_approver_id_decided_at_idx" ON "approval_decisions"("approver_id", "decided_at");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

ALTER TABLE "regions" ADD CONSTRAINT "regions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sppgs" ADD CONSTRAINT "sppgs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sppgs" ADD CONSTRAINT "sppgs_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_sppg_id_fkey" FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "features" JSON NULL;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
