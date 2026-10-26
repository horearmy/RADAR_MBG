CREATE TABLE "account_access_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_access_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "account_access_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "account_access_tokens_token_hash_key" ON "account_access_tokens"("token_hash");
CREATE INDEX "account_access_tokens_user_id_purpose_expires_at_idx" ON "account_access_tokens"("user_id", "purpose", "expires_at");
CREATE INDEX "account_access_tokens_consumed_at_expires_at_idx" ON "account_access_tokens"("consumed_at", "expires_at");
