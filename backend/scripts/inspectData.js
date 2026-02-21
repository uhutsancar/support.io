const mongoose = require('mongoose');

async function main(){
  await mongoose.connect('mongodb://localhost:27017/supportchat', { useNewUrlParser:true, useUnifiedTopology:true });
  const Site = require('../src/models/Site');
  const User = require('../src/models/User');
  const Conversation = require('../src/models/Conversation');
  console.log('sites count', await Site.countDocuments());
  console.log('sites', await Site.find().lean());
  console.log('users count', await User.countDocuments());
  console.log('users', await User.find().lean());
  console.log('convs count', await Conversation.countDocuments());
  console.log('some convs', await Conversation.find().lean().limit(5));
  process.exit(0);
}

main().catch(err=>{console.error(err);process.exit(1);});
