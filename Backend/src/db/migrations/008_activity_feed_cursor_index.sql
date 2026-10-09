-- 008_activity_feed_cursor_index.sql
-- Supports high-volume cursor pagination using composite (team_id, created_at DESC, id DESC)
-- Eliminates Incremental Sort and allows direct B-Tree index scan on tuple comparison (created_at, id) < ($cursor_time, $cursor_id)

CREATE INDEX IF NOT EXISTS idx_activity_logs_cursor 
ON activity_logs (team_id, created_at DESC, id DESC);
