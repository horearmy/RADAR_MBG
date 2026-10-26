CREATE TYPE "DeliveryReviewStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED');

CREATE TABLE "delivery_records" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "planned_quantity" INTEGER NOT NULL,
    "dispatched_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "shortage_quantity" INTEGER NOT NULL,
    "variance_reason" VARCHAR(2000),
    "receiver_user_id" UUID NOT NULL,
    "confirmation_note" VARCHAR(2000),
    "device_timestamp" TIMESTAMPTZ(6),
    "server_received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_status" "DeliveryReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_reason" VARCHAR(2000),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_records_version_check" CHECK ("version" > 0),
    CONSTRAINT "delivery_records_planned_check" CHECK ("planned_quantity" > 0),
    CONSTRAINT "delivery_records_dispatched_check" CHECK ("dispatched_quantity" > 0),
    CONSTRAINT "delivery_records_received_check" CHECK ("received_quantity" >= 0),
    CONSTRAINT "delivery_records_damaged_check" CHECK ("damaged_quantity" >= 0),
    CONSTRAINT "delivery_records_shortage_check" CHECK ("shortage_quantity" >= 0),
    CONSTRAINT "delivery_records_reconciliation_check" CHECK ("received_quantity" + "damaged_quantity" + "shortage_quantity" = "dispatched_quantity"),
    CONSTRAINT "delivery_records_variance_reason_check" CHECK (("received_quantity" + "damaged_quantity" = "dispatched_quantity" AND "damaged_quantity" = 0) OR "variance_reason" IS NOT NULL)
);

CREATE TABLE "proof_of_delivery" (
    "id" UUID NOT NULL,
    "delivery_record_id" UUID NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proof_of_delivery_size_check" CHECK ("byte_size" > 0),
    CONSTRAINT "proof_of_delivery_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "delivery_adjustments" (
    "id" UUID NOT NULL,
    "delivery_record_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_records_idempotency_key_key" ON "delivery_records"("idempotency_key");
CREATE UNIQUE INDEX "delivery_records_trip_id_version_key" ON "delivery_records"("trip_id", "version");
CREATE INDEX "delivery_records_trip_id_is_current_idx" ON "delivery_records"("trip_id", "is_current");
CREATE INDEX "delivery_records_review_status_created_at_idx" ON "delivery_records"("review_status", "created_at");
CREATE UNIQUE INDEX "delivery_records_one_current_per_trip_key" ON "delivery_records"("trip_id") WHERE "is_current" = true;
CREATE UNIQUE INDEX "proof_of_delivery_object_key_key" ON "proof_of_delivery"("object_key");
CREATE INDEX "proof_of_delivery_delivery_record_id_uploaded_at_idx" ON "proof_of_delivery"("delivery_record_id", "uploaded_at");
CREATE INDEX "delivery_adjustments_delivery_record_id_created_at_idx" ON "delivery_adjustments"("delivery_record_id", "created_at");

ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_delivery_record_id_fkey" FOREIGN KEY ("delivery_record_id") REFERENCES "delivery_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_adjustments" ADD CONSTRAINT "delivery_adjustments_delivery_record_id_fkey" FOREIGN KEY ("delivery_record_id") REFERENCES "delivery_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
