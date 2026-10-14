-- 015_add_language_to_user_settings.sql
-- Add language preference column to user_settings table for server-side coordination

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';
