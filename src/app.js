const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');
const timeout = require('./middleware/timeout');

const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const healthRoutes = require('./routes/healthRoutes');
const adminRoutes = require('./routes/adminRoutes');

const logger = require('./config/logger');
const CONSTANTS = require('./utils/constants');

// RapidAPI Authentication
const rapidApiAuth = process.env.RAPIDAPI_ENABLED === 'true'
  ? require('./middleware/rapidapiAuth')
  : null;

// Ensure logs directory exists (for winston file transport)
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Create and configure Express application
 * @returns {Object} Configured Express app instance
 */
const createApp = () => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({
    origin: corsOrigin,
    credentials: true
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request timeout
  const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000;
  app.use(timeout(requestTimeout));

  // Rate limiting
  app.use('/api/', rateLimiter);

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next();
  });

  // Root route - API welcome message
  app.get('/', (req, res) => {
    res.json({
      name: 'Expense Tracker API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        transactions: '/api/transactions',
        categories: '/api/categories',
        analytics: '/api/analytics',
        insights: '/api/analytics/insights'
      },
      documentation: '/api/docs (not implemented)'
    });
  });

  // Health check (always public)
  app.use('/health', healthRoutes);

  // Admin routes (protected by admin secret) - security through obscurity, add IP whitelist in production
  if (process.env.ADMIN_SECRET) {
    app.use('/admin', adminRoutes);
  }

  // API Routes - Apply RapidAPI authentication if enabled
  const apiMiddleware = rapidApiAuth ? [rapidApiAuth] : [];

  app.use('/api/transactions', ...apiMiddleware, transactionRoutes);
  app.use('/api/categories', ...apiMiddleware, categoryRoutes);
  app.use('/api/analytics', ...apiMiddleware, analyticsRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    return res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: 'NotFound',
      message: `Route ${req.method} ${req.originalUrl} not found`
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler());

  return app;
};

module.exports = createApp;