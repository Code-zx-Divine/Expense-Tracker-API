/**
 * MongoDB Database Connection Configuration
 * Uses mongoose with proper error handling for production deployment
 */

const mongoose = require('mongoose');

// Get MongoDB URI from environment
const MONGO_URI = process.env.MONGO_URI;

// Validation
if (!MONGO_URI) {
  console.error('❌ ERROR: MONGO_URI environment variable is not set');
  console.error('💡 Please set MONGO_URI in your Render environment variables');
  process.exit(1);
}

// Connection options
const mongooseOptions = {
  // For MongoDB Atlas with SRV records
  // Use consistent options for both local and Atlas
};

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async () => {
  const maxRetries = 3;
  let retryCount = 0;

  const attemptConnection = async () => {
    try {
      console.log('🔗 Connecting to MongoDB...');

      await mongoose.connect(MONGO_URI, mongooseOptions);

      console.log('✅ MongoDB Connected Successfully');
      console.log(`📊 Database: ${mongoose.connection.name || 'expense-tracker'}`);
      console.log(`🌍 Host: ${mongoose.connection.host}`);

      // Connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB Connection Error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB Disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB Reconnected');
      });

      return true;
    } catch (error) {
      console.error(`❌ MongoDB Connection Failed (Attempt ${retryCount + 1}/${maxRetries}):`, error.message);

      retryCount++;

      if (retryCount < maxRetries) {
        const delay = 2000 * retryCount; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptConnection();
      } else {
        console.error('❌ Max retries reached. Could not connect to MongoDB.');
        console.error('💡 Check your MONGO_URI and network connectivity');
        process.exit(1);
      }
    }
  };

  await attemptConnection();
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Closing MongoDB connection...`);

  try {
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

module.exports = { connectDB };
