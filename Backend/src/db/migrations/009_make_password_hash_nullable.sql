-- OAuth (Google) accounts authenticate without a local password,
-- so password_hash must be nullable for those users.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
