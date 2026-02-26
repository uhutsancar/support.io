const mongoose = require('mongoose');
async function main(){
  await mongoose.connect('mongodb://localhost:27017/supportchat', { useNewUrlParser:true, useUnifiedTopology:true });
  const Site = require('../src/models/Site');
  const User = require('../src/models/User');
  const Conversation = require('../src/models/Conversation');
  process.exit(0);
}
main().catch(err=>{process.exit(1);});
