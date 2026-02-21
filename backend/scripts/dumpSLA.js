require('dotenv').config();
const mongoose = require('mongoose');
const Conversation = require('../src/models/Conversation');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { });
    console.log('connected');
    const convs = await Conversation.find().limit(10).lean();
    convs.forEach(c => {
      console.log(c._id, c.status, c.sla);
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
