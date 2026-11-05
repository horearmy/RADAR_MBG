-- CreateEnum
CREATE TYPE "RecipientRegistrationStatus" AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateTable
CREATE TABLE "recipient_registration_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recipient_registration_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_registration_requests" (
    "id" UUID NOT NULL,
    "registration_code_id" UUID,
    "tenant_id" UUID NOT NULL,
    "requester_name" VARCHAR(160) NOT NULL,
    "contact_phone" VARCHAR(40),
    "contact_email" VARCHAR(200),
    "requested_site_name" VARCHAR(160),
    "notes" VARCHAR(2000),
    "status" "RecipientRegistrationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" VARCHAR(2000),
    "approved_recipient_site_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recipient_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipient_registration_codes_code_key" ON "recipient_registration_codes"("code");

-- CreateIndex
CREATE INDEX "recipient_registration_codes_tenant_id_active_idx" ON "recipient_registration_codes"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "recipient_registration_requests_tenant_id_status_idx" ON "recipient_registration_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "recipient_registration_requests_registration_code_id_idx" ON "recipient_registration_requests"("registration_code_id");

-- AddForeignKey
ALTER TABLE "recipient_registration_codes" ADD CONSTRAINT "recipient_registration_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_registration_requests" ADD CONSTRAINT "recipient_registration_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_registration_requests" ADD CONSTRAINT "recipient_registration_requests_registration_code_id_fkey" FOREIGN KEY ("registration_code_id") REFERENCES "recipient_registration_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_registration_requests" ADD CONSTRAINT "recipient_registration_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_registration_requests" ADD CONSTRAINT "recipient_registration_requests_approved_recipient_site_id_fkey" FOREIGN KEY ("approved_recipient_site_id") REFERENCES "recipient_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

