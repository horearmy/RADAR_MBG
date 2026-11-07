-- CreateTable
CREATE TABLE "recipient_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipient_site_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "stop_id" UUID,
    "rating" INTEGER NOT NULL,
    "emoji" VARCHAR(16),
    "comment" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recipient_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipient_reviews_recipient_site_id_created_at_idx" ON "recipient_reviews"("recipient_site_id", "created_at");

-- CreateIndex
CREATE INDEX "recipient_reviews_trip_id_idx" ON "recipient_reviews"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_reviews_user_id_stop_id_key" ON "recipient_reviews"("user_id", "stop_id");

-- AddForeignKey
ALTER TABLE "recipient_reviews" ADD CONSTRAINT "recipient_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_reviews" ADD CONSTRAINT "recipient_reviews_recipient_site_id_fkey" FOREIGN KEY ("recipient_site_id") REFERENCES "recipient_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_reviews" ADD CONSTRAINT "recipient_reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_reviews" ADD CONSTRAINT "recipient_reviews_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "delivery_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

