// Sets an organization's plan by hand (the closed beta, a support case).
//   development:  npm run plan:set -- <email> [FREE|PRO|ENTERPRISE]
//   production:   docker compose ... exec backend npm run plan:set:prod -- <email> ENTERPRISE
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from '../db/pool';
import { generateId } from '../db/objectId';
import User from '../models/User';
import Organization from '../models/Organization';
import { PLAN_TYPES, isPlanType } from '../domain';

async function updatePlan() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const plan = (process.argv[3] || 'ENTERPRISE').toUpperCase();

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
  if (rows[0]) {
    console.warn(
      `Warning: this organization has a Paddle subscription (${rows[0].status}); it takes precedence over this change.`
    );
  }

  const from = org.planType;
  if (from === plan) {
    console.log(`Organization "${org.name}" is already on ${plan}`);
    return;
  }
  org.planType = plan;
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
        operator: process.env.USER || process.env.USERNAME || null
      })
    ]
  );
  console.log(`Organization "${org.name}" set to ${plan} for ${email} (was ${from})`);
}

updatePlan()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
