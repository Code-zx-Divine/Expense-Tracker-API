const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const Usage = require('../models/Usage');
const logger = require('../config/logger');
const CONSTANTS = require('../utils/constants');

/**
 * JWT & API Key Authentication Middleware
 * Supports both JWT Bearer tokens and X-RapidAPI-Key headers
 * Also enforces quotas and tracks usage for API keys
 *
 * Usage:
 *   router.get('/protected', auth.required, handler)
 */
const auth = {
  /**
   * Verify authentication (JWT or API Key) and attach user to request
   * Also enforces rate limits and tracks usage for API keys
   */
  required: async (req, res, next) => {
    try {
      let user = null;
      let authType = null;
      let apiKeyDoc = null;

      // 1. Try JWT authentication first
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove "Bearer " prefix

        try {
          const JWT_SECRET = process.env.JWT_SECRET;
          if (!JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
          }

          const decoded = jwt.verify(token, JWT_SECRET);
          user = await User.findById(decoded.userId);
          authType = 'jwt';

          if (!user) {
            return res.status(401).json({
              success: false,
              error: 'Unauthorized',
              message: 'User no longer exists'
            });
          }

          if (user.status !== 'active') {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message: `Account is ${user.status}`
            });
          }
        } catch (error) {
          // If JWT fails, fall back to API key if present
          if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
            throw error;
          }
          // JWT error - will try API key below
        }
      }

      // 2. If JWT failed or not provided, try API Key authentication (RapidAPI or Bearer)
      if (!user) {
        // Check for API key in multiple places:
        // - x-rapidapi-key header (RapidAPI standard)
        // - x-api-key header (alternative)
        // - Authorization: Bearer <exp_key> (if token starts with exp_)
        let apiKey = req.headers['x-rapidapi-key'] || req.headers['x-api-key'] || req.query['rapidapi-key'];

        // Also check Authorization header if it starts with "exp_"
        if (!apiKey) {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // If token looks like an API key (starts with exp_), use it
            if (token.startsWith('exp_')) {
              apiKey = token;
            }
          }
        }

        if (apiKey) {
          apiKeyDoc = await ApiKey.findOne({
            key: apiKey,
            status: 'active'
          });

          if (apiKeyDoc) {
            // Check expiry
            if (apiKeyDoc.expiresAt && apiKeyDoc.expiresAt < new Date()) {
              apiKeyDoc.status = 'expired';
              await apiKeyDoc.save();
              return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Subscription expired. Renew to continue.',
                upgradeUrl: process.env.RAPIDAPI_UPGRADE_URL || 'https://rapidapi.com/yourusername/expense-tracker-api'
              });
            }

            // Check monthly quota
            if (apiKeyDoc.usageCurrentMonth >= apiKeyDoc.monthlyLimit) {
              logger.warn('Monthly quota exceeded', {
                apiKey: apiKey.substring(0, 8),
                email: apiKeyDoc.email,
                usage: apiKeyDoc.usageCurrentMonth,
                limit: apiKeyDoc.monthlyLimit
              });
              return res.status(429).json({
                success: false,
                error: 'QuotaExceeded',
                message: 'Monthly quota exceeded. Upgrade your plan.',
                quota: apiKeyDoc.quotaInfo,
                upgradeUrl: process.env.RAPIDAPI_UPGRADE_URL || 'https://rapidapi.com/yourusername/expense-tracker-api'
              });
            }

            // Check daily quota
            if (apiKeyDoc.usageToday >= apiKeyDoc.dailyLimit) {
              return res.status(429).json({
                success: false,
                error: 'DailyQuotaExceeded',
                message: 'Daily quota exceeded. Please try again tomorrow.',
                quota: apiKeyDoc.quotaInfo
              });
            }

            // Simple per-minute rate limiting (in-memory for now)
            const now = Date.now();
            const rateKey = `rate:${apiKey}`;
            if (!global.apiRateLimit) global.apiRateLimit = new Map();

            if (global.apiRateLimit.has(rateKey)) {
              const rl = global.apiRateLimit.get(rateKey);
              if (now < rl.reset) {
                if (rl.count >= apiKeyDoc.rateLimitPerMinute) {
                  return res.status(429).json({
                    success: false,
                    error: 'RateLimitExceeded',
                    message: `Rate limit: ${apiKeyDoc.rateLimitPerMinute} requests per minute`,
                    retryAfter: Math.ceil((rl.reset - now) / 1000)
                  });
                }
                rl.count++;
              } else {
                // Reset window
                global.apiRateLimit.set(rateKey, { count: 1, reset: now + 60000 });
              }
            } else {
              global.apiRateLimit.set(rateKey, { count: 1, reset: now + 60000 });
            }

            // Find user by email (API keys are linked to user emails)
            user = await User.findOne({ email: apiKeyDoc.email, status: 'active' });
            authType = 'api_key';

            if (!user) {
              return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'API key not linked to active user'
              });
            }

            // Add quota headers
            res.setHeader('X-API-Usage-Month', `${apiKeyDoc.usageCurrentMonth}/${apiKeyDoc.monthlyLimit}`);
            res.setHeader('X-API-Usage-Day', `${apiKeyDoc.usageToday}/${apiKeyDoc.dailyLimit}`);
            res.setHeader('X-API-Quota-Monthly', apiKeyDoc.monthlyLimit);
            res.setHeader('X-API-Quota-Daily', apiKeyDoc.dailyLimit);

            // Track usage after response
            const startTime = Date.now();
            const yearMonth = new Date().toISOString().slice(0, 7);
            const today = new Date().getDate();

            res.on('finish', async () => {
              try {
                const responseTime = Date.now() - startTime;

                // Create usage record
                const usage = new Usage({
                  apiKey: apiKey,
                  userId: user._id.toString(),
                  endpoint: req.originalUrl,
                  method: req.method,
                  statusCode: res.statusCode,
                  responseTime,
                  ip: req.ip,
                  userAgent: req.get('User-Agent') || '',
                  requestSize: Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8'),
                  responseSize: Buffer.byteLength(JSON.stringify(res.locals.responseBody || {}), 'utf8'),
                  yearMonth,
                  day: today
                });
                await usage.save();

                // Update counters
                apiKeyDoc.usageToday += 1;
                apiKeyDoc.usageCurrentMonth += 1;
                apiKeyDoc.lastUsedAt = new Date();
                await apiKeyDoc.save();
              } catch (error) {
                logger.error('Failed to track API usage:', error.message);
              }
            });
          } else {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message: 'Invalid API key'
            });
          }
        }
      }

      // 3. No valid authentication found
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required. Provide one of:\n' +
                   '  - Authorization: Bearer <JWT_token>\n' +
                   '  - Authorization: Bearer <exp_api_key>\n' +
                   '  - X-RapidAPI-Key: <exp_api_key>\n' +
                   '  - X-API-Key: <exp_api_key>'
        });
      }

      // Attach user to request object
      req.user = user;
      req.userId = user._id;
      req.authType = authType;

      next();
    } catch (error) {
      logger.error('Auth middleware error:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Authentication failed'
      });
    }
  },

  /**
   * Optional authentication - tries to authenticate but doesn't fail if no token
   * Useful for endpoints that work both with and without auth
   */
  optional: async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header, continue without user
      return next();
    }

    // Try to authenticate
    try {
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET;
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user && user.status === 'active') {
        req.user = user;
        req.userId = user._id;
      }
    } catch (error) {
      // Ignore errors, continue without user
    }

    next();
  },

  /**
   * Role-based authorization
   * Usage: auth.role('admin')
   */
  role: (allowedRoles) => {
    return async (req, res, next) => {
      // Ensure auth.required ran first
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Requires role: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    };
  },

  /**
   * Rate limiting per JWT user (API keys have separate quota system)
   * Checks if user has exceeded rate limit (1000 requests per hour)
   */
  rateLimit: async (req, res, next) => {
    // Skip if no user or if using API key authentication (quotas handled separately)
    if (!req.user || req.authType === 'api_key') {
      return next();
    }

    try {
      const user = await User.findById(req.user._id);
      const now = new Date();

      // Reset counter if new window (1 hour)
      if (!user.rateLimitResetAt || now > user.rateLimitResetAt) {
        user.rateLimitCount = 0;
        user.rateLimitResetAt = new Date(now.getTime() + 60 * 60 * 1000);
      }

      // Check limit
      const rateLimitMax = parseInt(process.env.USER_RATE_LIMIT_MAX) || 1000;
      if (user.rateLimitCount >= rateLimitMax) {
        return res.status(429).json({
          success: false,
          error: 'TooManyRequests',
          message: 'User rate limit exceeded. Please try again later.',
          resetAt: user.rateLimitResetAt,
          limit: rateLimitMax
        });
      }

      // Increment counter
      user.rateLimitCount += 1;
      await user.save({ validateBeforeSave: false });

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitMax.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitMax - user.rateLimitCount).toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(user.rateLimitResetAt.getTime() / 1000).toString());

      next();
    } catch (error) {
      logger.error('Rate limit error:', error.message);
      // Continue on error (don't block)
      next();
    }
  }
};

module.exports = auth;
