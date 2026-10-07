# Billing acceptance (Paddle sandbox)

Plan v10 BIL-02. The owner runs each scenario on **staging** with the real
Paddle sandbox checkout; the agent (or whoever is on call) checks the log
and the database after each step and ticks the box. Nothing here is done
until it has been run against Paddle — the automated tests
(`backend/tests/billing.e2e.test.ts`, `planOverage.e2e.test.ts`,
`invoices.e2e.test.ts`, `paddlePrices.test.ts`) sign their own webhooks and
stand in for Paddle's API, which proves our side only.

Record the date, the person and the workspace id next to each result.

## Before you start

- Staging runs with `PADDLE_ENV=sandbox`, `BILLING_ENABLED=true` and every
  `PADDLE_*` value filled (`docs/production-runbook.md` §7). The boot check
  refuses to start with one missing.
- Paddle → Notifications: a destination
  `https://staging.<domain>/api/billing/paddle/webhook` with the
  `subscription.*` events; its secret is `PADDLE_WEBHOOK_SECRET`.
- Paddle → Checkout settings: the default payment link points at the staging
  domain, and the domain is approved for the sandbox.
- Test cards: Paddle's sandbox documentation lists them ("Test cards"). Use
  its card that always succeeds for the purchases and its card that is
  always declined for scenario 3. Do not use a real card in the sandbox.
- A fresh workspace for the run: sign up on staging with a new address,
  verify it, note its id (`$C exec backend node dist/cli/listOrganizations.js <name>`).

Shortcuts used below (on the staging server):

```bash
C="docker compose -p supportio-staging --env-file .env.production -f docker-compose.prod.yml"
SQL() { $C exec -T postgres psql -U support_user supportchat -c "$1"; }
ORG=<workspace id>
```

The checks, run after each step:

```bash
# the plan in force and what Paddle told us
SQL "SELECT plan_type, billing_exempt FROM organizations WHERE id = '$ORG'"
SQL "SELECT plan_type, status, current_period_end, cancel_at_period_end, past_due_since, last_event_at
       FROM subscriptions WHERE organization_id = '$ORG'"
# every webhook and what we did with it
SQL "SELECT event_type, status, occurred_at, processed_at FROM billing_events
      WHERE organization_id = '$ORG' ORDER BY occurred_at"
# the audit trail of plan, site and seat changes
SQL "SELECT action, metadata, created_at FROM audit_logs
      WHERE organization_id = '$ORG'
        AND action IN ('PLAN_CHANGED','SITE_SUSPENDED','SITE_REACTIVATED','SEAT_SUSPENDED','SEAT_RESTORED')
      ORDER BY created_at"
# the log lines, never a payload
$C logs --since 15m backend | grep -E 'paddle (webhook|price)'
```

## Scenarios

### 1. Free → Pro monthly

1. Billing page → Upgrade plan → Pro, monthly → pay with the succeeding card.
2. Expect within a minute: `subscriptions.status = active`, `plan_type = PRO`
   on both rows, a `PLAN_CHANGED` audit row `{from: FREE, to: PRO, source: paddle}`,
   the billing page shows Pro with the renewal date, the limits meters show
   Pro's limits, a second site can be created.
3. The amount on the Paddle checkout equals the pricing page's
   (`GET /api/plans`); if the log shows `paddle price differs`, the pricing
   page already shows Paddle's figure — fix `domain/plans.ts` in the next
   release.
4. The invoice appears under Billing → Invoices once Paddle has billed it,
   and its PDF opens.

- [ ] passed — date / who / workspace:

### 2. Changing plans

1. Pro monthly → Pro yearly from the customer portal (Billing → Manage
   subscription). Expect `plan_type` still `PRO`, `current_period_end` a year
   out, Paddle's prorated charge on the invoice list.
2. Pro → Enterprise (Upgrade plan → Enterprise). Expect `ENTERPRISE`, limits up.
3. Create 5 sites and invite 6 members (over Pro's 3 sites and 5 seats).
4. Enterprise → Pro **at the end of the period** from the portal. Until the
   period ends nothing changes (`cancel_at_period_end` / scheduled change).
   To see the end without waiting, use Paddle's subscription simulator, or
   on staging only: `SQL "UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE organization_id = '$ORG'"`
   and wait for the hourly sweep (or restart the backend).
5. Expect after the downgrade: **nothing deleted**; 2 sites and 2 seats
   `SITE_SUSPENDED` / `SEAT_SUSPENDED` in the audit trail (oldest kept,
   owner always kept); the owner gets the "on hold" mail; the panel shows the
   amber strip and the choice on the billing page; a suspended site's widget
   does not appear on its page; a suspended member can sign in and read but
   the reply box answers "read-only".
6. On the billing page choose different sites/members to keep → the choice
   is applied at once. Upgrade again → everything comes back
   (`SITE_REACTIVATED`, `SEAT_RESTORED`).

- [ ] passed — date / who / workspace:

### 3. Failed payment

1. In the portal, replace the card with the always-declined test card, then
   trigger the renewal (Paddle sandbox: subscription simulator, "payment
   failed").
2. Expect `status = past_due`, `past_due_since` set, plan unchanged; the
   owner gets one "your payment did not go through" mail with the grace end
   date (`BILLING_PAST_DUE_GRACE_DAYS`, 7); the owner's panel shows the red
   strip. Paddle's own retry mails also arrive.
3. Either pay with the good card (strip goes, `status = active`), or let the
   grace run out (staging: move `past_due_since` back 8 days) → plan `FREE`,
   scenario 2's on-hold rules apply.

- [ ] passed — date / who / workspace:

### 4. Cancellation

1. Portal → cancel. Expect `cancel_at_period_end = true`, plan still Pro,
   the billing page says "ends on …".
2. When the period ends (simulator, or move `current_period_end` as above):
   plan `FREE`, data intact, extra sites/seats on hold.

- [ ] passed — date / who / workspace:

### 5. The same webhook twice

Paddle → Notifications → the delivered event → Replay.
Expect `billing_events` unchanged for that event id (the replay answers 200
with outcome `duplicate` in the log), no second `PLAN_CHANGED`.

- [ ] passed — date / who / workspace:

### 6. Out of order, and a bad signature

1. Replay an older `subscription.updated` after a newer one: log outcome
   `stale`, the subscription row keeps the newer state.
2. Temporarily set a wrong `PADDLE_WEBHOOK_SECRET` on staging, restart,
   send a test notification: Paddle's delivery log shows **400**, our log has
   `paddle webhook rejected` (reason `signature`, no body), and
   `supportio_billing_webhook_rejected_total` goes up
   (`$C exec backend wget -qO- 127.0.0.1:3000/internal/metrics | grep rejected`).
   Put the right secret back and restart.

- [ ] passed — date / who / workspace:

### 7. Customer portal

Billing page → Manage subscription opens Paddle's portal for this customer, in a
new tab; payment method, invoices and cancellation are there.

- [ ] passed — date / who / workspace:

### 8. Who sends which mail

Receipts and invoices come from **Paddle** (the merchant of record), not
from us. From us only: the trial reminders (PRD-15), "payment did not go
through" (BIL-05) and "over your plan, on hold" (BIL-04). Check the inbox of
the test address and the mail log (`$C logs backend | grep -i mail`) — no
receipt or invoice mail from our domain.

- [ ] passed — date / who / workspace:

## After the sandbox

Repeat scenario 1 in the **live** Paddle account with a real card and a
small plan, then refund it from Paddle (the refund policy, LEG-01, must be
published first). Only then announce paid plans.
