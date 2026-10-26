CREATE TABLE worker_leases (
  worker_name VARCHAR(100) PRIMARY KEY,
  owner_token UUID NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX worker_leases_expires_at_idx ON worker_leases (expires_at);
