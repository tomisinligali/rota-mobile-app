-- 006_create_notifications_and_tokens.sql
-- Durable notification intent, outbox queue table, and device push tokens

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  device_type VARCHAR(50) NOT NULL DEFAULT 'expo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_device_token UNIQUE (user_id, push_token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON device_push_tokens(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'SHIFT_CREATED', 'SHIFT_UPDATED', 'SHIFT_CANCELLED', 'SWAP_REQUESTED', 'SWAP_APPROVED', 'SWAP_REJECTED', 'OPEN_SHIFT_CLAIMED'
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'DEAD'
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_next_attempt ON notification_outbox(next_attempt_at);
