// Raises an organization's plan. Usage:
//   npx tsx scripts/updatePlan.ts <email> [FREE|PRO|ENTERPRISE]
// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import { pool } from '../src/db/pool';
import User from '../src/models/User';
import Organization from '../src/models/Organization';
import { PLAN_TYPES, isPlanType } from '../src/domain';


async function updatePlan() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const plan = (process.argv[3] || 'ENTERPRISE').toUpperCase();

  if (!email) {
    console.error('Usage: npx tsx scripts/updatePlan.ts <email> [FREE|PRO|ENTERPRISE]');
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

  org.planType = plan;
  await org.save();
  console.log(`Organization "${org.name}" set to ${plan} for ${email}`);
}

updatePlan()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
