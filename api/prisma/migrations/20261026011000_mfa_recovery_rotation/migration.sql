ALTER TABLE "users"
ADD COLUMN "mfa_pending_secret_encrypted" VARCHAR(512),
ADD COLUMN "mfa_pending_expires_at" TIMESTAMPTZ(6);

CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mfa_recovery_codes_token_hash_key" ON "mfa_recovery_codes"("token_hash");
CREATE INDEX "mfa_recovery_codes_user_id_used_at_idx" ON "mfa_recovery_codes"("user_id", "used_at");
