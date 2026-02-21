const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set!');
      console.error('Please check your .env file and ensure MONGODB_URI is configured.');
      process.exit(1);
    }

    const options = {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    };

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (error.message.includes('IP')) {
      console.error('\n💡 IP Whitelist Issue Detected:');
      console.error('Your IP address may not be whitelisted in MongoDB Atlas.');
      console.error('Please:');
      console.error('1. Go to MongoDB Atlas → Network Access');
      console.error('2. Add your current IP address (or use 0.0.0.0/0 for development)');
      console.error('3. Wait a few minutes for changes to propagate');
      console.error('\n📝 Current connection string:', process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    } else if (error.message.includes('authentication')) {
      console.error('\n💡 Authentication Issue Detected:');
      console.error('Please check your MongoDB username and password in the connection string.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 DNS/Network Issue Detected:');
      console.error('Cannot resolve MongoDB hostname. Please check:');
      console.error('1. Your internet connection');
      console.error('2. MongoDB Atlas cluster status');
      console.error('3. Connection string format');
    }
    
    console.error('\n🔧 Troubleshooting:');
    console.error('- Check your .env file for MONGODB_URI');
    console.error('- Verify MongoDB Atlas cluster is running');
    console.error('- Check network/firewall settings');
    console.error('- Ensure MongoDB credentials are correct\n');
    
    process.exit(1);
  }
};

module.exports = connectDB;
