-- 003_create_shifts_and_activity.sql

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_status') THEN
        CREATE TYPE shift_status AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  modified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role_name VARCHAR(100),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status shift_status NOT NULL DEFAULT 'PUBLISHED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_shift_time CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_team_time ON shifts(team_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_shifts_assigned_time ON shifts(assigned_to_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_shifts_team_status ON shifts(team_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_team_created ON activity_logs(team_id, created_at DESC);
