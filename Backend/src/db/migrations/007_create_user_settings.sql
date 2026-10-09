-- 007_create_user_settings.sql
-- User cross-device settings respected by server and client

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  shift_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  swap_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  auto_sync_offline BOOLEAN NOT NULL DEFAULT TRUE,
  start_day_of_week INT NOT NULL DEFAULT 1, -- 1 = Monday, 0 = Sunday
  theme VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults for existing users
INSERT INTO user_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
