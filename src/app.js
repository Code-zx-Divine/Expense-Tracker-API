const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const swagger = require('./config/swagger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');
const timeout = require('./middleware/timeout');

const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const healthRoutes = require('./routes/healthRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');

const logger = require('./config/logger');
const CONSTANTS = require('./utils/constants');

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

  // 1. Request ID - first middleware for tracing
  const requestId = require('./middleware/requestId');
  app.use(requestId);

  // 2. Security middleware
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      }
    } : false // Disable CSP in development for Swagger UI
  }));

  // 3. CORS configuration
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({
    origin: corsOrigin,
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-API-Usage-Month', 'X-API-Usage-Day']
  }));

  // 4. Body parsing with limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. MongoDB request sanitization (prevent query injection)
  app.use(mongoSanitize());

  // 6. Compression
  app.use(compression());

  // 7. Request timeout
  const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000;
  app.use(timeout(requestTimeout));

  // 8. Rate limiting - apply to all non-internal routes
  // Skip rate limiting for health checks in development
  const skipHealthCheck = process.env.NODE_ENV === 'development';
  app.use('/api/', (req, res, next) => {
    if (skipHealthCheck && req.path === 'health') {
      return next();
    }
    return rateLimiter(req, res, next);
  });

  // 9. Request logging middleware with request ID
  app.use((req, res, next) => {
    const startTime = Date.now();

    // Log after response finishes
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.info(`${req.method} ${req.originalUrl}`, {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userId: req.userId || req.apiKey || null,
        authType: req.authType || 'none'
      });
    });

    next();
  });

  // Root route - API welcome message
  app.get('/', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    res.json({
      name: 'Expense Tracker API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        documentation: '/api-docs (Swagger UI)',
        'API Root': '/api',
        auth: {
          description: 'User authentication (JWT)',
          routes: {
            'POST /auth/register': 'Register new user',
            'POST /auth/login': 'User login',
            'GET /auth/me': 'Get current user profile',
            'PUT /auth/profile': 'Update profile',
            'PUT /auth/password': 'Change password',
            'POST /auth/refresh': 'Refresh JWT token'
          }
        },
        transactions: {
          description: 'Income and expense transactions (JWT or API Key)',
          routes: {
            'POST /api/transactions/expense': 'Add an expense',
            'POST /api/transactions/income': 'Add income',
            'GET /api/transactions': 'List all transactions (with filters)',
            'GET /api/transactions/:id': 'Get single transaction',
            'PUT /api/transactions/:id': 'Update transaction',
            'DELETE /api/transactions/:id': 'Soft delete transaction'
          }
        },
        categories: {
          description: 'Transaction categories',
          routes: {
            'GET /api/categories': 'List all categories',
            'GET /api/categories/:id': 'Get single category',
            'POST /api/categories': 'Create category',
            'PUT /api/categories/:id': 'Update category',
            'DELETE /api/categories/:id': 'Delete category'
          }
        },
        analytics: {
          description: 'Financial analytics and insights',
          routes: {
            'GET /api/analytics/categories': 'Category-wise spending',
            'GET /api/analytics/summary': 'Financial summary',
            'GET /api/analytics/monthly': 'Monthly trends',
            'GET /api/analytics/insights': 'AI-powered insights'
          }
        }
      },
      authentication: {
        methods: ['JWT Bearer token', 'X-RapidAPI-Key header'],
        instructions: 'Include either Authorization: Bearer <token> OR X-RapidAPI-Key: <key>'
      },
      database: isDbConnected ? 'MongoDB ✅' : 'MongoDB ⚠️ (disconnected)',
      multiTenancy: 'Users only see their own data',
      rateLimiting: {
        ipBased: `${process.env.RATE_LIMIT_MAX_REQUESTS} requests per ${Math.round(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 60000)} minutes`,
        userBased: '1000 requests per hour (authenticated users)'
      }
    });
  });

  // Health check (always public)
  app.use('/health', healthRoutes);

  // Swagger API Documentation
  // Access at: /api-docs (Swagger UI) and /api-docs.json (OpenAPI spec)
  app.use('/api-docs', swagger.swaggerUi.serve, swagger.swaggerUi.setup(swagger.swaggerSpec));

  // Auth routes (public - no auth required)
  // These routes handle user registration/login
  app.use('/auth', authRoutes);

  // Backward compatibility: Redirect legacy routes (without /api prefix) to correct paths
  // These redirects help users who call /transactions instead of /api/transactions
  // IMPORTANT: Placed BEFORE protected API routes to avoid auth middleware interference
  app.use('/transactions', (req, res) => {
    const path = req.path.toLowerCase();

    // Build target URL preserving query string
    const queryString = req.url.split('?')[1];
    const targetPath = `/api/transactions${path}`;
    const targetUrl = queryString ? `${targetPath}?${queryString}` : targetPath;

    // Return helpful error with correct path
    return res.status(301).json({
      success: false,
      error: 'RouteMoved',
      message: `This endpoint has moved to /api/transactions${path || ''}`,
      correctUrl: `/api/transactions${path || ''}`,
      documentation: '/api-docs'
    });
  });

  app.use('/categories', (req, res) => {
    const path = req.path.toLowerCase();
    const queryString = req.url.split('?')[1];
    const targetPath = `/api/categories${path}`;
    const targetUrl = queryString ? `${targetPath}?${queryString}` : targetPath;

    return res.status(301).json({
      success: false,
      error: 'RouteMoved',
      message: `This endpoint has moved to /api/categories${path || ''}`,
      correctUrl: `/api/categories${path || ''}`,
      documentation: '/api-docs'
    });
  });

  app.use('/analytics', (req, res) => {
    const path = req.path.toLowerCase();
    const queryString = req.url.split('?')[1];
    const targetPath = `/api/analytics${path}`;
    const targetUrl = queryString ? `${targetPath}?${queryString}` : targetPath;

    return res.status(301).json({
      success: false,
      error: 'RouteMoved',
      message: `This endpoint has moved to /api/analytics${path || ''}`,
      correctUrl: `/api/analytics${path || ''}`,
      documentation: '/api-docs'
    });
  });

  // API root - shows available endpoints
  app.get('/api', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    const apiInfo = {
      name: 'Expense Tracker API',
      version: '1.0.0',
      status: 'running',
      documentation: '/api-docs',
      authentication: 'JWT Bearer token OR X-RapidAPI-Key header',
      database: isDbConnected ? 'MongoDB Connected' : 'MongoDB Disconnected',
      endpoints: {
        transactions: '/api/transactions',
        categories: '/api/categories',
        analytics: '/api/analytics',
        insights: '/api/analytics/insights'
      }
    };

    // Include admin endpoints if ADMIN_SECRET is set
    if (process.env.ADMIN_SECRET) {
      apiInfo.admin = {
        description: 'Admin APIs (require X-Admin-Secret header)',
        routes: {
          'POST /admin/apikeys': 'Create API key',
          'GET /admin/apikeys': 'List API keys',
          'GET /admin/apikeys/:key': 'Get API key details',
          'PUT /admin/apikeys/:key/status': 'Update API key status',
          'DELETE /admin/apikeys/:key': 'Revoke API key',
          'GET /admin/stats/usage': 'Usage statistics'
        }
      };
    }

    return res.json({
      success: true,
      ...apiInfo
    });
  });

  // Admin routes (protected by admin secret)
  if (process.env.ADMIN_SECRET) {
    app.use('/admin', adminRoutes);
  }

  // Auth middleware for protected API routes
  const { auth: authMiddleware, rateLimit: userRateLimit } = require('./middleware/auth');
  const { userFilter } = require('./middleware/userFilter');

  // API Routes with authentication
  // Order matters: authMiddleware (authenticates) -> userRateLimit (rate limit) -> userFilter (data isolation)
  const apiAuth = [authMiddleware, userRateLimit, userFilter];

  // Transactions - require authentication + user-based filtering
  app.use('/api/transactions', ...apiAuth, transactionRoutes);
  app.use('/api/categories', ...apiAuth, categoryRoutes);
  app.use('/api/analytics', ...apiAuth, analyticsRoutes);

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