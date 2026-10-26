CREATE TYPE "GeofenceType" AS ENUM ('SPPG', 'DELIVERY');
CREATE TYPE "QrTokenStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');
CREATE TYPE "ArrivalVerificationResult" AS ENUM ('VERIFIED', 'PENDING_LOCATION', 'GPS_ACCURACY_INSUFFICIENT', 'INVALID_QR', 'WRONG_DESTINATION', 'MANUAL_REVIEW_REQUIRED');

CREATE TABLE "geofences" (
    "id" UUID NOT NULL,
    "sppg_id" UUID,
    "delivery_location_id" UUID,
    "type" "GeofenceType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "center_latitude" DECIMAL(9,6) NOT NULL,
    "center_longitude" DECIMAL(9,6) NOT NULL,
    "center" geography(Point, 4326),
    "radius_meters" DECIMAL(8,2) NOT NULL,
    "min_gps_accuracy_m" DECIMAL(8,2) NOT NULL DEFAULT 50,
    "confirmation_fixes" INTEGER NOT NULL DEFAULT 2,
    "confirmation_duration_seconds" INTEGER NOT NULL DEFAULT 10,
    "idempotency_key" VARCHAR(128),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "geofences_single_location_check" CHECK (num_nonnulls("sppg_id", "delivery_location_id") = 1),
    CONSTRAINT "geofences_type_location_check" CHECK (("type" = 'SPPG' AND "sppg_id" IS NOT NULL AND "delivery_location_id" IS NULL) OR ("type" = 'DELIVERY' AND "delivery_location_id" IS NOT NULL AND "sppg_id" IS NULL)),
    CONSTRAINT "geofences_latitude_range_check" CHECK ("center_latitude" >= -90 AND "center_latitude" <= 90),
    CONSTRAINT "geofences_longitude_range_check" CHECK ("center_longitude" >= -180 AND "center_longitude" <= 180),
    CONSTRAINT "geofences_radius_check" CHECK ("radius_meters" > 0 AND "radius_meters" <= 10000),
    CONSTRAINT "geofences_accuracy_check" CHECK ("min_gps_accuracy_m" > 0),
    CONSTRAINT "geofences_confirmation_fixes_check" CHECK ("confirmation_fixes" BETWEEN 2 AND 10),
    CONSTRAINT "geofences_confirmation_duration_check" CHECK ("confirmation_duration_seconds" BETWEEN 0 AND 120)
);

CREATE TABLE "qr_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "delivery_location_id" UUID NOT NULL,
    "trip_id" UUID,
    "issued_by" UUID NOT NULL,
    "status" "QrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "used_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qr_tokens_expiry_check" CHECK ("expires_at" > "issued_at")
);

CREATE TABLE "arrival_verifications" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "qr_token_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "result" "ArrivalVerificationResult" NOT NULL,
    "reason_code" VARCHAR(80),
    "request_hash" VARCHAR(64) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "gps_accuracy_m" DECIMAL(8,2) NOT NULL,
    "device_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "server_received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arrival_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "arrival_verifications_latitude_range_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "arrival_verifications_longitude_range_check" CHECK ("longitude" >= -180 AND "longitude" <= 180),
    CONSTRAINT "arrival_verifications_accuracy_check" CHECK ("gps_accuracy_m" >= 0)
);

CREATE UNIQUE INDEX "geofences_idempotency_key_key" ON "geofences"("idempotency_key");
CREATE INDEX "geofences_sppg_id_active_version_idx" ON "geofences"("sppg_id", "active", "version");
CREATE INDEX "geofences_delivery_location_id_active_version_idx" ON "geofences"("delivery_location_id", "active", "version");
CREATE INDEX "geofences_center_idx" ON "geofences" USING GIST ("center");
CREATE UNIQUE INDEX "qr_tokens_token_hash_key" ON "qr_tokens"("token_hash");
CREATE INDEX "qr_tokens_delivery_location_id_status_expires_at_idx" ON "qr_tokens"("delivery_location_id", "status", "expires_at");
CREATE INDEX "qr_tokens_trip_id_status_expires_at_idx" ON "qr_tokens"("trip_id", "status", "expires_at");
CREATE UNIQUE INDEX "arrival_verifications_trip_id_idempotency_key_key" ON "arrival_verifications"("trip_id", "idempotency_key");
CREATE INDEX "arrival_verifications_trip_id_created_at_idx" ON "arrival_verifications"("trip_id", "created_at");
CREATE INDEX "arrival_verifications_result_created_at_idx" ON "arrival_verifications"("result", "created_at");

ALTER TABLE "geofences" ADD CONSTRAINT "geofences_sppg_id_fkey" FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "arrival_verifications" ADD CONSTRAINT "arrival_verifications_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "arrival_verifications" ADD CONSTRAINT "arrival_verifications_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "qr_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
