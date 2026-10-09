-- 004_create_shift_swaps.sql

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_swap_type') THEN
        CREATE TYPE shift_swap_type AS ENUM ('DIRECT_SWAP', 'OPEN_SHIFT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_swap_status') THEN
        CREATE TYPE shift_swap_status AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'EXECUTED', 'FAILED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS shift_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  type shift_swap_type NOT NULL,
  status shift_swap_status NOT NULL DEFAULT 'REQUESTED',
  reason TEXT,
  approved_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swaps_team_status ON shift_swaps(team_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_shift_status ON shift_swaps(shift_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_requester ON shift_swaps(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_target ON shift_swaps(target_user_id, status);
