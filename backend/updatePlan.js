const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function updatePlan() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'sancaruhut@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    if (!user.organizationId) {
      console.log('User has no organization');
      process.exit(1);
    }

    const org = await Organization.findById(user.organizationId);
    if (!org) {
      console.log('Organization not found');
      process.exit(1);
    }

    org.planType = 'ENTERPRISE';
    await org.save();

    console.log('Successfully updated organization plan to ENTERPRISE for user: sancaruhut@gmail.com');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

updatePlan();
