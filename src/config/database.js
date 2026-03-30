const mongoose = require('mongoose');
const logger = require('./logger');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  logger.error('❌ MONGO_URI environment variable is not set');
  process.exit(1);
}

const connectDB = async () => {
  try {
    logger.info(`🔗 Connecting to MongoDB Atlas...`);

    await mongoose.connect(MONGO_URI, {
      // Mongoose 6+ connection options
    });

    logger.info('✅ MongoDB connected successfully');
    logger.info(`📊 Database: ${mongoose.connection.name}`);
    logger.info(`🌍 Host: ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('✅ MongoDB reconnected');
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      logger.error('Full error:', error);
    }
    logger.error('💡 Troubleshooting tips:');
    logger.error('   1. Verify MONGO_URI in .env is correct');
    logger.error('   2. Ensure your IP is whitelisted in MongoDB Atlas');
    logger.error('   3. Check username/password is correct');
    logger.error('   4. Verify cluster is running and accessible');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('📦 MongoDB connection closed through app termination');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  logger.info('📦 MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = { connectDB };