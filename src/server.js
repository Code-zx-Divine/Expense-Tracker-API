/**
 * Expense Tracker API - Production Server
 * Render-optimized with proper startup sequence and error handling
 */

require('dotenv').config();

const { connectDB } = require('./config/database');
const createApp = require('./app');
const Category = require('./models/Category');

// START SERVER FUNCTION
const startServer = async () => {
  try {
    console.log('🚀 Starting Expense Tracker API...');
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);

    // 1. Connect to MongoDB FIRST
    await connectDB();

    // 2. Create Express app
    const app = createApp();

    // 3. Seed default categories (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      try {
        await Category.seedDefaultCategories();
      } catch (error) {
        console.error('⚠️ Warning: Could not seed categories:', error.message);
        // Don't exit - server can still run
      }
    }

    // 4. Determine PORT (Render sets PORT env var)
    const PORT = process.env.PORT || 3000;

    // 5. Start listening
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ Server is running!');
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log(`📚 API: http://localhost:${PORT}/api`);
    });

    // 6. Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });

    // 7. Graceful shutdown for both HTTP server and MongoDB
    const gracefulShutdown = async (signal) => {
      console.log(`${signal} received. Starting graceful shutdown...`);

      try {
        // Close HTTP server
        server.close(async () => {
          console.log('📦 HTTP server closed');
          try {
            // Close MongoDB connection
            await mongoose.connection.close();
            console.log('📦 MongoDB connection closed');
            process.exit(0);
          } catch (error) {
            console.error('❌ Error closing MongoDB:', error);
            process.exit(1);
          }
        });

        // Force shutdown after 10 seconds if server doesn't close
        setTimeout(() => {
          console.error('❌ Forcing shutdown after timeout');
          process.exit(1);
        }, 10000).unref();
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
