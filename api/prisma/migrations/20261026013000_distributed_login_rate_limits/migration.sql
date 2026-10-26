CREATE TABLE login_rate_limits (
  bucket_key VARCHAR(64) PRIMARY KEY,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  expires_at TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX login_rate_limits_expires_at_idx ON login_rate_limits (expires_at);
