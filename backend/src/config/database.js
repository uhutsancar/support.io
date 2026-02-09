const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔄 MongoDB bağlantısı kuruluyor...');
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI?.split('@')[1]?.split('/')[0] || 'URI bulunamadı');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ MongoDB bağlantısı başarılı!');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🌐 Host:', mongoose.connection.host);
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası!');
    console.error('🔴 Hata detayı:', error.message);
    console.error('💡 Çözüm önerileri:');
    console.error('   1. MongoDB Atlas\'ta Network Access ayarlarını kontrol et');
    console.error('   2. IP adresinizi whitelist\'e ekle (0.0.0.0/0)');
    console.error('   3. Database User şifresini kontrol et');
    console.error('   4. Cluster\'ın aktif olduğundan emin ol');
    process.exit(1);
  }
};

// MongoDB bağlantı olaylarını dinle
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose bağlantısı aktif');
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️  Mongoose bağlantı hatası:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📴 Mongoose bağlantısı kesildi');
});

module.exports = connectDB;
