// Sets an organization's plan by hand (the closed beta, a support case).
//   development:  npm run plan:set -- <email> [FREE|PRO|ENTERPRISE] [--exempt|--not-exempt]
//   production:   docker compose ... exec backend node dist/cli/updatePlan.js <email> ENTERPRISE --exempt
//
// --exempt keeps the plan where it is set: no Paddle event moves it (SEC-05;
// the platform owner's own workspace, beta customers). --not-exempt hands the
// organization back to billing.
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from '../db/pool';
import { generateId } from '../db/objectId';
import User from '../models/User';
import Organization from '../models/Organization';
import { PLAN_TYPES, isPlanType } from '../domain';
import { reconcilePlanLimits } from '../services/planOverage';

async function updatePlan() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const [rawEmail, rawPlan] = args.filter((a) => !a.startsWith('--'));
  const email = (rawEmail || '').toLowerCase().trim();
  const plan = (rawPlan || 'ENTERPRISE').toUpperCase();
  const exempt = flags.has('--exempt') ? true : flags.has('--not-exempt') ? false : null;

  if (!email) {
    console.error('Usage: npm run plan:set -- <email> [FREE|PRO|ENTERPRISE]');
    process.exitCode = 1;
    return;
  }
  // The list lives in src/domain/constants.ts, so this script cannot drift
  // from what the model and the plan gate accept.
  if (!isPlanType(plan)) {
    console.error(`Invalid plan "${plan}". Expected one of: ${PLAN_TYPES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exitCode = 1;
    return;
  }
  if (!user.organizationId) {
    console.error('User has no organization');
    process.exitCode = 1;
    return;
  }

  const org = await Organization.findById(user.organizationId);
  if (!org) {
    console.error('Organization not found');
    process.exitCode = 1;
    return;
  }

  // A Paddle subscription decides the plan while it exists
  // (services/entitlements.ts#getPlan); a hand-set value would not hold.
  const { rows } = await query<{ status: string }>(
    'SELECT status FROM subscriptions WHERE organization_id = $1',
    [org._id]
  );
  if (rows[0] && !exempt && !org.billingExempt) {
    console.warn(
      `Warning: this organization has a Paddle subscription (${rows[0].status}); it takes precedence over this change.`
    );
  }

  const from = org.planType;
  const exemptBefore = Boolean(org.billingExempt);
  const exemptAfter = exempt ?? exemptBefore;
  if (from === plan && exemptBefore === exemptAfter) {
    console.log(
      `Organization "${org.name}" is already on ${plan}${exemptAfter ? ' (billing exempt)' : ''}`
    );
    return;
  }
  org.planType = plan;
  org.billingExempt = exemptAfter;
  await org.save();
  // The same audit row billing writes, so the trail shows hand changes too.
  await query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, NULL, 'PLAN_CHANGED', 'organization', $2, $3)`,
    [
      generateId(),
      org._id,
      JSON.stringify({
        from,
        to: plan,
        source: 'script',
        billingExempt: exemptAfter,
        operator: process.env.USER || process.env.USERNAME || null
      })
    ]
  );
  // Sites and seats over a smaller plan go on hold, or come back (BIL-04).
  const overage = await reconcilePlanLimits(String(org._id));
  console.log(
    `Organization "${org.name}" set to ${plan} for ${email} (was ${from})` +
      (exemptAfter ? '; billing exempt: subscription events leave it alone' : '')
  );
  for (const [label, list] of Object.entries(overage) as Array<[string, string[]]>) {
    if (list.length) console.log(`  ${label}: ${list.join(', ')}`);
  }
}

updatePlan()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
