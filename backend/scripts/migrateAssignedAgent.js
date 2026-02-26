
const mongoose = require('mongoose');
require('dotenv').config();
const Conversation = require('../src/models/Conversation');
const Team = require('../src/models/Team');
const User = require('../src/models/User');
async function main() {
  const mongo = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/support_chat_app';
  await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
  const conversations = await Conversation.find({ assignedAgent: { $ne: null } }).lean();
  let updated = 0;
  for (const conv of conversations) {
    const assignedId = conv.assignedAgent?.toString();
    if (!assignedId) continue;
    const team = await Team.findById(assignedId).lean();
    if (team) {
      continue;
    }
    const user = await User.findById(assignedId).lean();
    if (!user) {
      continue;
    }
    const mappedTeam = await Team.findOne({ email: user.email }).lean();
    if (!mappedTeam) {
      continue;
    }
    const update = {};
    if (conv.assignedAgent && conv.assignedAgent.toString() === assignedId) update.assignedAgent = mappedTeam._id;
    if (conv.assignedBy && conv.assignedBy.toString() === assignedId) update.assignedBy = mappedTeam._id;
    if (Object.keys(update).length > 0) {
      await Conversation.updateOne({ _id: conv._id }, { $set: update });
      updated++;
    }
  }
  await mongoose.disconnect();
}
main().catch(err => {
  process.exit(1);
});
