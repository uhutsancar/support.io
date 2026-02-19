/*
Migration helper: map Conversation.assignedAgent entries that currently reference a User id
to the corresponding Team id where possible (Team having same email).

Run with: node ./scripts/migrateAssignedAgent.js

This script will log changes and only modify conversations when a mapping is found.
Review output before running in production; backup DB first.
*/

const mongoose = require('mongoose');
require('dotenv').config();

const Conversation = require('../src/models/Conversation');
const Team = require('../src/models/Team');
const User = require('../src/models/User');

async function main() {
  const mongo = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/support_chat_app';
  await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', mongo);

  const conversations = await Conversation.find({ assignedAgent: { $ne: null } }).lean();
  console.log('Found', conversations.length, 'conversations with assignedAgent');

  let updated = 0;
  for (const conv of conversations) {
    const assignedId = conv.assignedAgent?.toString();
    if (!assignedId) continue;

    const team = await Team.findById(assignedId).lean();
    if (team) {
      // already a Team id, nothing to do
      continue;
    }

    const user = await User.findById(assignedId).lean();
    if (!user) {
      console.warn(`No Team or User found for id ${assignedId} (conversation ${conv._id}). Skipping.`);
      continue;
    }

    // Try to find a Team with same email
    const mappedTeam = await Team.findOne({ email: user.email }).lean();
    if (!mappedTeam) {
      console.warn(`User ${assignedId} (${user.email}) has no matching Team (conversation ${conv._id}). Skipping.`);
      continue;
    }

    // Update conversation assignedAgent/assignedBy if they reference the old user id
    const update = {};
    if (conv.assignedAgent && conv.assignedAgent.toString() === assignedId) update.assignedAgent = mappedTeam._id;
    if (conv.assignedBy && conv.assignedBy.toString() === assignedId) update.assignedBy = mappedTeam._id;

    if (Object.keys(update).length > 0) {
      await Conversation.updateOne({ _id: conv._id }, { $set: update });
      console.log(`Updated conversation ${conv._id}: assignedAgent -> Team ${mappedTeam._id}`);
      updated++;
    }
  }

  console.log('Migration complete. Updated', updated, 'conversations.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
