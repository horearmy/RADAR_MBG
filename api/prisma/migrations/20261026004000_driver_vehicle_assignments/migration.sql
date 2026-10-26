CREATE TABLE "driver_vehicle_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sppg_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "reason" VARCHAR(2000) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_vehicle_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_vehicle_assignments_range_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

CREATE INDEX "driver_vehicle_assignments_driver_id_effective_from_idx"
    ON "driver_vehicle_assignments"("driver_id", "effective_from");
CREATE INDEX "driver_vehicle_assignments_vehicle_id_effective_from_idx"
    ON "driver_vehicle_assignments"("vehicle_id", "effective_from");
CREATE INDEX "driver_vehicle_assignments_sppg_id_effective_from_idx"
    ON "driver_vehicle_assignments"("sppg_id", "effective_from");

ALTER TABLE "driver_vehicle_assignments"
    ADD CONSTRAINT "driver_vehicle_assignments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_vehicle_assignments"
    ADD CONSTRAINT "driver_vehicle_assignments_sppg_id_fkey"
    FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_vehicle_assignments"
    ADD CONSTRAINT "driver_vehicle_assignments_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_vehicle_assignments"
    ADD CONSTRAINT "driver_vehicle_assignments_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_vehicle_assignments"
    ADD CONSTRAINT "driver_vehicle_assignments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
