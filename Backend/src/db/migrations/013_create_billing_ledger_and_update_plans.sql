-- 013_create_billing_ledger_and_update_plans.sql
-- Updates plan tiers to STARTER, TEAM, BUSINESS and introduces immutable billing ledger

-- 1. Ensure enum contains STARTER, TEAM, BUSINESS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
        CREATE TYPE subscription_tier AS ENUM ('STARTER', 'TEAM', 'BUSINESS');
    ELSE
        -- Add TEAM and BUSINESS if they do not exist
        BEGIN
            ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'TEAM';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'BUSINESS';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 2. Add scheduled downgrade fields to subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS scheduled_plan_tier VARCHAR(50),
ADD COLUMN IF NOT EXISTS scheduled_seat_count INT,
ADD COLUMN IF NOT EXISTS scheduled_effective_at TIMESTAMPTZ;

-- 3. Create immutable billing_ledger table
-- Every charge, credit, and refund is an append-only row that is never edited or deleted.
CREATE TABLE IF NOT EXISTS billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  entry_type VARCHAR(50) NOT NULL, -- 'CHARGE', 'CREDIT', 'REFUND', 'CORRECTION'
  amount_cents INT NOT NULL, -- Stored strictly in integer cents (e.g. 2000 = $20.00)
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  idempotency_key VARCHAR(255),
  provider_payment_id VARCHAR(255),
  provider_event_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_business ON billing_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_subscription ON billing_ledger(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_idempotency ON billing_ledger(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_provider_event ON billing_ledger(provider_event_id);

-- Enforce immutability on billing_ledger via trigger to prevent UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Billing ledger entries are immutable and cannot be updated or deleted. Create a new CORRECTION entry instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_ledger_immutable ON billing_ledger;
CREATE TRIGGER trg_billing_ledger_immutable
BEFORE UPDATE OR DELETE ON billing_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_mutation();
