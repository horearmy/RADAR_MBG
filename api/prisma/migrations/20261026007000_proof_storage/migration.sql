ALTER TABLE "proof_of_delivery" ADD COLUMN "original_name" VARCHAR(255);

CREATE UNIQUE INDEX "proof_of_delivery_delivery_record_id_sha256_key"
    ON "proof_of_delivery"("delivery_record_id", "sha256");
