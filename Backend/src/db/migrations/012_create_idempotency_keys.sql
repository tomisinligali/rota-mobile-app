-- 012_create_idempotency_keys.sql
-- Durable storage for retry-safe mutations and idempotent replay

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  scope VARCHAR(100) NOT NULL,
  request_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
  response_code INTEGER,
  response_body JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_idempotency_scope_key UNIQUE (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_scope_key ON idempotency_keys(scope, key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);
