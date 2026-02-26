require('dotenv').config();
const mongoose = require('mongoose');
const Conversation = require('../src/models/Conversation');
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { });
    const convs = await Conversation.find().limit(10).lean();
    convs.forEach(c => {
    });
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
}
main();
