-- 010_create_email_verification_codes.sql
-- Single-use, time-limited email verification codes.
-- Only a SHA-256 hash of the 6-digit code is stored; the plaintext code is
-- emailed to the user and never persisted. Rows are retained (consumed_at
-- set) rather than deleted so attempted/reused codes can be audited and
-- rejected.
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookups always scope to a single user and its unconsumed, unexpired code.
CREATE INDEX IF NOT EXISTS idx_email_verification_user_created
  ON email_verification_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verification_code_hash
  ON email_verification_codes(code_hash);
