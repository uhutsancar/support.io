// Raises an organization's plan. Usage:
//   node updatePlan.js <email> [FREE|PRO|ENTERPRISE]
require('dotenv').config();

const { pool } = require('./src/db/pool');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

const VALID_PLANS = ['FREE', 'PRO', 'ENTERPRISE'];

async function updatePlan() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const plan = (process.argv[3] || 'ENTERPRISE').toUpperCase();

  if (!email) {
    console.error('Usage: node updatePlan.js <email> [FREE|PRO|ENTERPRISE]');
    process.exitCode = 1;
    return;
  }
  if (!VALID_PLANS.includes(plan)) {
    console.error(`Invalid plan "${plan}". Expected one of: ${VALID_PLANS.join(', ')}`);
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
