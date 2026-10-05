-- 0006 — paid plans through Paddle (plan §9).
--
-- `subscriptions` is what Paddle last told us about an organization's
-- subscription; the plan the server enforces is derived from it
-- (services/billing.ts#effectivePlan), so a cancelled subscription keeps its
-- plan until the paid period ends and a failed payment gets a grace period,
-- without a webhook having to arrive at that exact moment.
--
-- `billing_events` makes webhook delivery idempotent: Paddle retries, and an
-- event id that is already here is answered 200 without being applied again.
-- Only a hash of the payload is kept, not the payload (data minimisation).
CREATE TABLE IF NOT EXISTS subscriptions (
  id                        varchar(24) PRIMARY KEY,
  organization_id           varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  provider                  text NOT NULL DEFAULT 'paddle',
  provider_customer_id      text,
  provider_subscription_id  text NOT NULL,
  plan_type                 text NOT NULL,
  status                    text NOT NULL,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean NOT NULL DEFAULT false,
  -- When the subscription went past_due; the grace period counts from here.
  past_due_since            timestamptz,
  -- occurred_at of the newest event applied; an older event never undoes it.
  last_event_at             timestamptz NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_provider_check CHECK (provider IN ('paddle')),
  CONSTRAINT subscriptions_plan_type_check CHECK (plan_type IN ('FREE', 'PRO', 'ENTERPRISE')),
  CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'trialing', 'past_due', 'paused', 'canceled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_organization ON subscriptions (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_provider_id
  ON subscriptions (provider, provider_subscription_id);

CREATE TABLE IF NOT EXISTS billing_events (
  provider_event_id  text PRIMARY KEY,
  event_type         text NOT NULL,
  occurred_at        timestamptz NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  payload_hash       text NOT NULL,
  organization_id    varchar(24) REFERENCES organizations (id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'received',
  CONSTRAINT billing_events_status_check
    CHECK (status IN ('received', 'processed', 'ignored', 'stale'))
);
CREATE INDEX IF NOT EXISTS idx_billing_events_org
  ON billing_events (organization_id, occurred_at DESC);
