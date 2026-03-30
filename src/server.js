require('dotenv').config();

const { connectDB } = require('./config/database');
const createApp = require('./app');
const Category = require('./models/Category');
const logger = require('./config/logger');

// Start server after DB connection
const startServer = async () => {
  try {
    // Create Express app
    const app = createApp();

    // Connect to MongoDB
    await connectDB();

    // Seed default categories (development only)
    if (process.env.NODE_ENV !== 'production') {
      try {
        await Category.seedDefaultCategories();
      } catch (error) {
        logger.error('Error seeding categories:', error.message);
      }
    }

    // Determine port from environment or default
    const PORT = process.env.PORT || 3000;

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`✅ Server listening on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
      logger.info(`💚 Health check: http://localhost:${PORT}/health`);
    });

    // Handle host binding errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
      } else {
        logger.error('❌ Server error:', err);
      }
      process.exit(1);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      server.close(() => {
        logger.info('🚪 HTTP server closed');

        // Close MongoDB connection
        require('mongoose').connection.close(false, () => {
          logger.info('📦 MongoDB connection closed');
          process.exit(0);
        });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
      logger.error('Unhandled Promise Rejection:', err);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();