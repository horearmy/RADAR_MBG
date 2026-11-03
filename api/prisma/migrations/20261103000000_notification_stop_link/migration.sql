-- AlterTable
ALTER TABLE "notification_events" ADD COLUMN "stop_id" UUID,
ADD COLUMN "trip_id" UUID;

-- CreateIndex
CREATE INDEX "notification_events_stop_id_idx" ON "notification_events"("stop_id");
CREATE INDEX "notification_events_trip_id_idx" ON "notification_events"("trip_id");
