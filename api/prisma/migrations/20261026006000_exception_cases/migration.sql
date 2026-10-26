CREATE TYPE "ExceptionSeverity" AS ENUM ('ATTENTION', 'HIGH', 'CRITICAL');
CREATE TYPE "ExceptionSource" AS ENUM ('GPS_STALE', 'OFFLINE', 'ROUTE_DEVIATION', 'LATE_ARRIVAL', 'QR_FAILURE', 'QUANTITY_VARIANCE', 'POD_INCOMPLETE', 'OTHER');
CREATE TYPE "ExceptionStatus" AS ENUM ('DETECTED', 'TRIAGED', 'ASSIGNED', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'FALSE_POSITIVE', 'DUPLICATE', 'CLOSED_WITH_NOTE');

CREATE TABLE "exception_cases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "sppg_id" UUID NOT NULL,
    "trip_id" UUID,
    "source" "ExceptionSource" NOT NULL,
    "dedupe_key" VARCHAR(160),
    "title" VARCHAR(200) NOT NULL,
    "details" VARCHAR(4000),
    "severity" "ExceptionSeverity" NOT NULL DEFAULT 'ATTENTION',
    "status" "ExceptionStatus" NOT NULL DEFAULT 'DETECTED',
    "assignee_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "resolution_note" VARCHAR(4000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "exception_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exception_events" (
    "id" UUID NOT NULL,
    "exception_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "from_status" VARCHAR(40),
    "to_status" VARCHAR(40) NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "note" VARCHAR(4000),
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exception_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exception_cases_organization_id_dedupe_key_key"
    ON "exception_cases"("organization_id", "dedupe_key");
CREATE INDEX "exception_cases_status_severity_opened_at_idx"
    ON "exception_cases"("status", "severity", "opened_at");
CREATE INDEX "exception_cases_sppg_id_status_idx"
    ON "exception_cases"("sppg_id", "status");
CREATE INDEX "exception_cases_assignee_user_id_status_idx"
    ON "exception_cases"("assignee_user_id", "status");
CREATE INDEX "exception_events_exception_id_occurred_at_idx"
    ON "exception_events"("exception_id", "occurred_at");

ALTER TABLE "exception_cases"
    ADD CONSTRAINT "exception_cases_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_cases"
    ADD CONSTRAINT "exception_cases_region_id_fkey"
    FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_cases"
    ADD CONSTRAINT "exception_cases_sppg_id_fkey"
    FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_cases"
    ADD CONSTRAINT "exception_cases_trip_id_fkey"
    FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_events"
    ADD CONSTRAINT "exception_events_exception_id_fkey"
    FOREIGN KEY ("exception_id") REFERENCES "exception_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
