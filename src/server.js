/**
 * Expense Tracker API - Production Server
 * Render-optimized with proper startup sequence and error handling
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('./config/database');
const createApp = require('./app');
const Category = require('./models/Category');

// START SERVER FUNCTION
const startServer = async () => {
  console.log('🚀 Starting Expense Tracker API...');
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);

  let dbConnected = false;
  let app;

  try {
    // 1. Connect to MongoDB (non-blocking - app starts even if this fails)
    console.log('🔗 Connecting to MongoDB...');
    dbConnected = await connectDB();
    if (!dbConnected) {
      console.warn('⚠️  Starting server without database connection');
    }
  } catch (error) {
    console.error('⚠️  MongoDB connection error (non-fatal):', error.message);
    console.warn('⚠️  Starting server without database connection');
  }

  try {
    // 2. Create Express app
    app = createApp();

    // 3. Seed default categories (only if DB connected and in non-production)
    if (dbConnected && process.env.NODE_ENV !== 'production') {
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
      console.log(`📊 Database: ${dbConnected ? '✅ Connected' : '⚠️  Disconnected'}`);
    });

    // 6. Handle server errors (just log, don't exit)
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', err);
      }
      // Don't exit - Render expects the process to stay alive
    });

    // 7. Graceful shutdown for both HTTP server and MongoDB
    const gracefulShutdown = async (signal) => {
      console.log(`${signal} received. Starting graceful shutdown...`);

      try {
        // Close HTTP server
        server.close(async () => {
          console.log('📦 HTTP server closed');

          // Close MongoDB connection if connected
          try {
            if (dbConnected && mongoose.connection.readyState === 1) {
              await mongoose.connection.close();
              console.log('📦 MongoDB connection closed');
            }
            process.exit(0);
          } catch (error) {
            console.error('❌ Error closing MongoDB:', error);
            // Even if close fails, exit cleanly (no crash)
            process.exit(0);
          }
        });

        // Force shutdown after 10 seconds if server doesn't close
        setTimeout(() => {
          console.error('❌ Forcing shutdown after timeout');
          process.exit(0); // Exit cleanly even on timeout
        }, 10000).unref();
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(0); // Exit cleanly even if there's an error
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    // Even if server creation fails, we still start a minimal server
    console.warn('⚠️  Starting minimal fallback server...');

    // Create a minimal Express app with just health check
    const express = require('express');
    const minimalApp = express();
    const PORT = process.env.PORT || 3000;

    // Health check endpoint
    minimalApp.get('/health', (req, res) => {
      res.status(503).json({
        success: false,
        status: 'degraded',
        timestamp: new Date().toISOString(),
        error: 'Server initialization failed',
        uptime: process.uptime()
      });
    });

    // Root endpoint
    minimalApp.get('/', (req, res) => {
      res.json({
        name: 'Expense Tracker API',
        version: '1.0.0',
        status: 'degraded',
        message: 'Server started but in degraded mode due to initialization errors',
        endpoints: {
          health: '/health'
        }
      });
    });

    minimalApp.listen(PORT, '0.0.0.0', () => {
      console.log('✅ Minimal fallback server running on port', PORT);
    });
  }
};

// Start the server
startServer();
