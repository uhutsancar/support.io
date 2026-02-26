const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {

      process.exit(1);
    }

    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(process.env.MONGODB_URI, options);

    
    mongoose.connection.on('error', (err) => {

    });

    mongoose.connection.on('disconnected', () => {

    });

    mongoose.connection.on('reconnected', () => {

    });

  } catch (error) {

    
    if (error.message.includes('IP')) {

    } else if (error.message.includes('authentication')) {

    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {

    }

    
    process.exit(1);
  }
};

module.exports = connectDB;
