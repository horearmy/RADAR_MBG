CREATE TYPE "ArrivalOverrideDecision" AS ENUM ('VERIFIED');

CREATE TABLE "arrival_overrides" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "decision" "ArrivalOverrideDecision" NOT NULL DEFAULT 'VERIFIED',
    "reason" VARCHAR(2000) NOT NULL,
    "evidence_note" VARCHAR(2000),
    "from_status" VARCHAR(40) NOT NULL,
    "to_status" VARCHAR(40) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arrival_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arrival_overrides_trip_id_idempotency_key_key"
    ON "arrival_overrides"("trip_id", "idempotency_key");
CREATE INDEX "arrival_overrides_trip_id_created_at_idx"
    ON "arrival_overrides"("trip_id", "created_at");

ALTER TABLE "arrival_overrides"
    ADD CONSTRAINT "arrival_overrides_trip_id_fkey"
    FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
