-- AlterTable
ALTER TABLE "geofences" ADD COLUMN "shape_type" VARCHAR(20) NOT NULL DEFAULT 'CIRCLE';
ALTER TABLE "geofences" ADD COLUMN "polygon_coordinates" JSONB;
ALTER TABLE "geofences" ALTER COLUMN "center_latitude" DROP NOT NULL;
ALTER TABLE "geofences" ALTER COLUMN "center_longitude" DROP NOT NULL;
ALTER TABLE "geofences" ALTER COLUMN "radius_meters" DROP NOT NULL;

-- Backfill existing rows
UPDATE "geofences" SET "shape_type" = 'CIRCLE' WHERE "shape_type" IS NULL;