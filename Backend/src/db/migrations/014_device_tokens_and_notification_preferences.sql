-- 014_device_tokens_and_notification_preferences.sql
-- Support multiple devices per user, grouped notification preferences, and quiet hours with timezones

-- 1. Device Push Tokens: Add device_id and device_name to track multiple devices per user
ALTER TABLE device_push_tokens ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
ALTER TABLE device_push_tokens ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);

-- Ensure a user's specific device has at most one active token
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_push_tokens_user_device 
  ON device_push_tokens(user_id, device_id) 
  WHERE device_id IS NOT NULL;

-- Index on push_token for fast lookup & deletion of invalid tokens
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_push_token 
  ON device_push_tokens(push_token);

-- 2. User Settings: Grouped notification categories, quiet hours, and timezone
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_shift_changes BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_swaps BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_billing BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_hours_start VARCHAR(5) NOT NULL DEFAULT '22:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_hours_end VARCHAR(5) NOT NULL DEFAULT '08:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'UTC';
