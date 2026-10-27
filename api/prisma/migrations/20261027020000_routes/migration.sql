CREATE TABLE "routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sppg_id" UUID NOT NULL,
    "delivery_location_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "coordinates" JSONB NOT NULL,
    "distance_meters" DECIMAL(12,2),
    "estimated_duration_seconds" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "routes_sppg_id_fkey" FOREIGN KEY ("sppg_id") REFERENCES "sppgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "routes_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "routes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "routes_sppg_id_delivery_location_id_active_version_idx" ON "routes"("sppg_id", "delivery_location_id", "active", "version");