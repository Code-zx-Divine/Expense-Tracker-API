/**
 * MongoDB Database Connection Configuration
 * Uses mongoose with proper error handling for production deployment
 */

const mongoose = require('mongoose');

// Get MongoDB URI from environment
const MONGO_URI = process.env.MONGO_URI;

// Clean MongoDB URI (if exists)
let cleanMongoURI = '';
if (MONGO_URI) {
  cleanMongoURI = MONGO_URI.trim().replace(/^["']|["']$/g, '');
}

// Connection options
const mongooseOptions = {
  // For MongoDB Atlas with SRV records
  // Use consistent options for both local and Atlas
};

/**
 * Connect to MongoDB with retry logic
 * NOTE: This function will NOT crash the app if connection fails
 */
const connectDB = async () => {
  // If no MONGO_URI, skip connection entirely
  if (!cleanMongoURI) {
    console.warn('⚠️  Skipping MongoDB connection: MONGO_URI not set');
    console.warn('⏳ Server will start without database connectivity');
    return false;
  }

  // Validate URI format
  if (!cleanMongoURI.startsWith('mongodb://') && !cleanMongoURI.startsWith('mongodb+srv://')) {
    console.warn('⚠️  Skipping MongoDB connection: Invalid MONGO_URI format');
    console.warn('📝 Must start with mongodb:// or mongodb+srv://');
    console.warn('💡 Current value:', cleanMongoURI.substring(0, 50) + '...');
    console.warn('⏳ Server will start without database connectivity');
    return false;
  }

  // Check for common issues
  if (cleanMongoURI.includes('retryWrites') && !cleanMongoURI.includes('retryWrites=')) {
    console.warn('⚠️  Skipping MongoDB connection: malformed retryWrites parameter');
    console.warn('📝 Correct format: ?retryWrites=true&w=majority');
    console.warn('💡 Current value:', cleanMongoURI);
    console.warn('⏳ Server will start without database connectivity');
    return false;
  }

  // If using SRV, ensure database name is included
  const pathParts = cleanMongoURI.split('/');
  const dbPart = pathParts[3] || '';

  if (cleanMongoURI.startsWith('mongodb+srv://') && (!dbPart || dbPart.includes('@') || dbPart.startsWith('?'))) {
    console.warn('⚠️  Skipping MongoDB connection: missing database name');
    console.warn('📝 Format: mongodb+srv://user:pass@cluster/dbname?retryWrites=true&w=majority');
    console.warn('💡 Current value:', cleanMongoURI);
    console.warn('⏳ Server will start without database connectivity');
    return false;
  }

  const maxRetries = 3;
  let retryCount = 0;

  const attemptConnection = async () => {
    try {
      console.log('🔗 Connecting to MongoDB...');
      console.log(`📡 URI: ${cleanMongoURI.substring(0, 30)}...`);

      await mongoose.connect(cleanMongoURI, mongooseOptions);

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

      // Provide specific guidance for common connection errors
      if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        console.error('\\n🔧 Troubleshooting Tips:');
        console.error('   1. Check your internet connection');
        console.error('   2. Verify MONGO_URI is correct');
        console.error('   3. Ensure MongoDB Atlas cluster is active (not paused)');
        console.error('   4. Check Atlas IP whitelist - add your current IP');
        console.error('   5. Verify database user credentials are correct');
        console.error('   6. For local development, ensure port 27017 is accessible\\n');
      }

      retryCount++;

      if (retryCount < maxRetries) {
        const delay = 2000 * retryCount; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptConnection();
      } else {
        console.error('❌ Max retries reached. Could not connect to MongoDB.');
        console.error('💡 Server will continue running without database connectivity');
        console.error('💡 Check your MONGO_URI and network connectivity');
        return false; // Return false instead of exiting
      }
    }
  };

  return await attemptConnection();
};

// Graceful shutdown - keep this as it only runs during shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Closing MongoDB connection...`);

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('📦 MongoDB connection closed');
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
    // Even if close fails, exit cleanly (no crash)
    process.exit(0);
  }
};

// Handle termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections - log but don't exit immediately
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // Don't exit - let the process continue
});

// Handle uncaught exceptions - these are serious but we still want to log
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // For production stability, don't exit immediately
  // Log and let the process continue or let Render restart if needed
});

module.exports = { connectDB };
