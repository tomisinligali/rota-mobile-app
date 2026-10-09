-- 005_create_subscriptions.sql
-- Subscriptions, seat-based pricing, proration history, and Flutterwave webhook deduplication

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
        CREATE TYPE subscription_tier AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'RESTRICTED', 'CANCELLED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  plan_tier subscription_tier NOT NULL DEFAULT 'STARTER',
  seat_count INT NOT NULL DEFAULT 5,
  status subscription_status NOT NULL DEFAULT 'TRIALING',
  unit_price_cents INT NOT NULL DEFAULT 400, -- Integer pence/cents per seat (e.g. £4.00)
  currency VARCHAR(10) NOT NULL DEFAULT 'GBP',
  trial_starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  grace_period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_subscription UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  type VARCHAR(50) NOT NULL, -- 'TRIAL_STARTED', 'SEATS_CHANGED', 'PLAN_UPGRADED', 'PLAN_DOWNGRADED', 'PAYMENT_SUCCEEDED', 'WEBHOOK_PROCESSED'
  amount_cents INT NOT NULL DEFAULT 0, -- Monetary value stored strictly in smallest currency unit
  prorated_amount_cents INT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'GBP',
  description TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  provider_event_id VARCHAR(255), -- For at-least-once Flutterwave webhook deduplication
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_provider_event_id UNIQUE (provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_business_id ON billing_events(business_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_id ON billing_events(subscription_id);

-- Ensure existing businesses have a starter trial subscription
INSERT INTO subscriptions (business_id, plan_tier, seat_count, status, unit_price_cents, currency)
SELECT b.id, 'STARTER', 5, 'TRIALING', 400, 'GBP'
FROM businesses b
ON CONFLICT (business_id) DO NOTHING;
