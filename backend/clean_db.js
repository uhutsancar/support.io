const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function cleanDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB successfully.\n');

    const db = mongoose.connection.db;
    
    // 1. Wipe bad configs
    const configCol = db.collection('widgetconfigs');
    const cRes = await configCol.updateMany(
        { 'messages.welcomeMessage': { $regex: /help you today/i } },
        { $set: { 'messages.welcomeMessage': '' } }
    );
    console.log(`Cleaned ${cRes.modifiedCount} WidgetConfigs.`);

    // 2. Wipe bad site configs
    const siteCol = db.collection('sites');
    const sRes = await siteCol.updateMany(
        { 'widgetSettings.welcomeMessage': { $regex: /help you today/i } },
        { $set: { 'widgetSettings.welcomeMessage': '' } }
    );
    console.log(`Cleaned ${sRes.modifiedCount} Sites.`);

    // 3. Nuke historical ghost messages
    const msgCol = db.collection('messages');
    const mRes = await msgCol.deleteMany({ content: { $regex: /help you today/i } });
    console.log(`Deleted ${mRes.deletedCount} ghost English messages from history.`);

    // 4. Force check proactive rules to find any duplicate triggers
    const rulesCol = db.collection('proactiverules');
    const rules = await rulesCol.find({ isActive: true }).toArray();
    console.log(`\nActive Rules: ${rules.length}`);
    rules.forEach(r => console.log(`- ID: ${r._id}, Event: ${r.triggerCondition.eventType}, Action: ${r.action.messageContent?.substring(0, 30)}, Once: ${r.frequencyControl?.triggerOncePerVisitor}`));

  } catch (err) {
    console.error('DB Clean Error:', err);
  } finally {
    process.exit(0);
  }
}

cleanDb();
