CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'READY_TO_DEPART', 'IN_TRANSIT', 'ARRIVAL_DETECTED', 'ARRIVAL_VERIFIED', 'DELIVERY_IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXCEPTION');
CREATE TYPE "TrackingStatus" AS ENUM ('LIVE', 'STALE', 'OFFLINE', 'GPS_UNAVAILABLE', 'ENDED');
CREATE TYPE "ArrivalVerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'MANUAL_REVIEW', 'OVERRIDDEN');
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DELIVERED', 'PARTIAL', 'FAILED', 'UNDER_REVIEW');

CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "sppg_id" UUID NOT NULL,
    "user_id" UUID,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sppg_id" UUID NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "label" VARCHAR(100),
    "capacity" INTEGER,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicles_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0)
);

CREATE TABLE "delivery_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(500),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "coordinates" geography(Point, 4326),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "delivery_locations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_locations_latitude_range_check" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
    CONSTRAINT "delivery_locations_longitude_range_check" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
    CONSTRAINT "delivery_locations_coordinate_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);

CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sppg_id" UUID NOT NULL,
    "delivery_location_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "idempotency_key" VARCHAR(128),
    "planned_departure_at" TIMESTAMPTZ(6) NOT NULL,
    "planned_arrival_at" TIMESTAMPTZ(6) NOT NULL,
    "actual_departure_at" TIMESTAMPTZ(6),
    "arrival_detected_at" TIMESTAMPTZ(6),
    "arrival_verified_at" TIMESTAMPTZ(6),
    "delivery_started_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "tracking_status" "TrackingStatus" NOT NULL DEFAULT 'OFFLINE',
    "verification_status" "ArrivalVerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "planned_quantity" INTEGER NOT NULL,
    "dispatched_quantity" INTEGER,
    "received_quantity" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "trips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trips_schedule_check" CHECK ("planned_arrival_at" > "planned_departure_at"),
    CONSTRAINT "trips_planned_quantity_check" CHECK ("planned_quantity" > 0),
    CONSTRAINT "trips_dispatched_quantity_check" CHECK ("dispatched_quantity" IS NULL OR "dispatched_quantity" >= 0),
    CONSTRAINT "trips_received_quantity_check" CHECK ("received_quantity" IS NULL OR "received_quantity" >= 0)
);

CREATE TABLE "gps_positions" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "gps_accuracy_m" DECIMAL(8,2),
    "speed_mps" DECIMAL(8,2),
    "heading_deg" DECIMAL(6,2),
    "device_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "server_received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence_number" INTEGER,
    "device_id" VARCHAR(100),
    "source" VARCHAR(32) NOT NULL,
    "integrity_flags" JSONB NOT NULL DEFAULT '[]',
    "idempotency_key" VARCHAR(128) NOT NULL,
    CONSTRAINT "gps_positions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gps_positions_latitude_range_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "gps_positions_longitude_range_check" CHECK ("longitude" >= -180 AND "longitude" <= 180),
    CONSTRAINT "gps_positions_accuracy_check" CHECK ("gps_accuracy_m" IS NULL OR "gps_accuracy_m" >= 0),
    CONSTRAINT "gps_positions_speed_check" CHECK ("speed_mps" IS NULL OR "speed_mps" >= 0),
    CONSTRAINT "gps_positions_heading_check" CHECK ("heading_deg" IS NULL OR ("heading_deg" >= 0 AND "heading_deg" < 360))
);

CREATE TABLE "trip_events" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "from_status" VARCHAR(40),
    "to_status" VARCHAR(40),
    "reason" VARCHAR(2000),
    "device_timestamp" TIMESTAMPTZ(6),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "idempotency_key" VARCHAR(128),
    CONSTRAINT "trip_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");
CREATE INDEX "drivers_sppg_id_status_idx" ON "drivers"("sppg_id", "status");
CREATE UNIQUE INDEX "drivers_sppg_id_code_key" ON "drivers"("sppg_id", "code");
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");
CREATE INDEX "vehicles_organization_id_status_idx" ON "vehicles"("organization_id", "status");
CREATE INDEX "vehicles_sppg_id_status_idx" ON "vehicles"("sppg_id", "status");
CREATE INDEX "delivery_locations_organization_id_active_idx" ON "delivery_locations"("organization_id", "active");
CREATE INDEX "delivery_locations_region_id_active_idx" ON "delivery_locations"("region_id", "active");
CREATE INDEX "delivery_locations_coordinates_idx" ON "delivery_locations" USING GIST ("coordinates");
CREATE UNIQUE INDEX "delivery_locations_organization_id_code_key" ON "delivery_locations"("organization_id", "code");
CREATE UNIQUE INDEX "trips_idempotency_key_key" ON "trips"("idempotency_key");
CREATE INDEX "trips_organization_id_status_planned_departure_at_idx" ON "trips"("organization_id", "status", "planned_departure_at");
CREATE INDEX "trips_sppg_id_planned_departure_at_idx" ON "trips"("sppg_id", "planned_departure_at");
CREATE INDEX "trips_delivery_location_id_planned_arrival_at_idx" ON "trips"("delivery_location_id", "planned_arrival_at");
CREATE INDEX "trips_driver_id_status_idx" ON "trips"("driver_id", "status");
CREATE INDEX "trips_vehicle_id_status_idx" ON "trips"("vehicle_id", "status");
CREATE INDEX "gps_positions_trip_id_device_timestamp_idx" ON "gps_positions"("trip_id", "device_timestamp");
CREATE INDEX "gps_positions_trip_id_server_received_at_idx" ON "gps_positions"("trip_id", "server_received_at");
CREATE UNIQUE INDEX "gps_positions_trip_id_idempotency_key_key" ON "gps_positions"("trip_id", "idempotency_key");
CREATE INDEX "trip_events_trip_id_occurred_at_idx" ON "trip_events"("trip_id", "occurred_at");
CREATE INDEX "trip_events_event_type_occurred_at_idx" ON "trip_events"("event_type", "occurred_at");
CREATE UNIQUE INDEX "trip_events_trip_id_idempotency_key_key" ON "trip_events"("trip_id", "idempotency_key");

ALTER TABLE "drivers" ADD CONSTRAINT "drivers_sppg_id_fkey" FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_sppg_id_fkey" FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_sppg_id_fkey" FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gps_positions" ADD CONSTRAINT "gps_positions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
