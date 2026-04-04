const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const Usage = require('../models/Usage');
const logger = require('../config/logger');
const CONSTANTS = require('../utils/constants');

// RapidAPI configuration
const RAPIDAPI_ENABLED = process.env.RAPIDAPI_ENABLED
  ? process.env.RAPIDAPI_ENABLED.toLowerCase() === 'true'
  : false;
const RAPIDAPI_USER_ID = process.env.RAPIDAPI_USER_ID
  ? new mongoose.Types.ObjectId(process.env.RAPIDAPI_USER_ID)
  : new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'); // Fixed fallback ObjectId
const RAPIDAPI_USER_EMAIL = process.env.RAPIDAPI_USER_EMAIL || 'rapidapi@example.com';

/**
 * JWT & API Key Authentication Middleware
 * Supports both JWT Bearer tokens and X-RapidAPI-Key headers
 * Also supports RapidAPI proxy mode (skip DB validation when RAPIDAPI_ENABLED)
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

      console.log('[AUTH] Starting authentication check, RAPIDAPI_ENABLED:', RAPIDAPI_ENABLED);

      // 1. Try JWT authentication first
      const authHeader = req.headers.authorization;
      const proxySecretHeader = req.get('X-RapidAPI-Proxy-Secret') || req.headers['x-rapidapi-proxy-secret'];
      console.log('[AUTH] Incoming auth headers', {
        authorization: !!authHeader,
        xRapidApiKey: !!req.headers['x-rapidapi-key'],
        xApiKey: !!req.headers['x-api-key'],
        xRapidApiProxySecret: !!proxySecretHeader,
        xForwardedFor: req.headers['x-forwarded-for'] || null,
        headerKeys: Object.keys(req.headers).filter((k) => /rapidapi|x-api-key|authorization|x-forwarded-for/i.test(k))
      });

      if (RAPIDAPI_ENABLED && process.env.RAPIDAPI_PROXY_SECRET && proxySecretHeader === process.env.RAPIDAPI_PROXY_SECRET) {
        console.log('[AUTH] RapidAPI request detected');
        console.log('[AUTH] Valid RapidAPI proxy secret received');

        user = {
          _id: RAPIDAPI_USER_ID,
          email: RAPIDAPI_USER_EMAIL,
          name: 'RapidAPI User',
          role: 'subscriber',
          status: 'active',
          isRapidAPI: true
        };
        authType = 'rapidapi-proxy';

        res.setHeader('X-API-Quota-Monthly', 'unlimited');
        res.setHeader('X-API-Quota-Daily', 'unlimited');
        res.setHeader('X-API-Usage-Month', 'N/A');
        res.setHeader('X-API-Usage-Day', 'N/A');

        return next();
      }

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

          console.log('[AUTH] JWT authentication successful:', { userId: decoded.userId });

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
          console.log('[AUTH] JWT validation failed, trying API key fallback:', error.message);
          // JWT error - will try API key below
        }
      }

      // 2. If JWT failed or not provided, try API Key authentication (RapidAPI or Bearer)
      if (!user) {
        // Helper to read headers robustly in both raw and normalized forms.
        const getHeader = (name) => {
          if (!name) return undefined;
          const normalized = name.toLowerCase();
          return req.headers[normalized] || req.get(name) || req.get(normalized);
        };

        // Check for API key in multiple places:
        // - X-RapidAPI-Key header (RapidAPI standard)
        // - X-API-Key header (alternative)
        // - Authorization: Bearer <key> (API key bearer tokens)
        // - rapidapi-key query param fallback
        let apiKey = getHeader('X-RapidAPI-Key') || getHeader('X-API-Key') || req.query['rapidapi-key'] || req.query['x-rapidapi-key'];

        if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
          apiKey = authHeader.substring(7).trim();
        }

        if (apiKey) {
          apiKey = apiKey.toString().trim();
        }

        console.log('[AUTH] API key check - RAPIDAPI_ENABLED:', RAPIDAPI_ENABLED, 'apiKey present:', !!apiKey, 'apiKey value:', apiKey ? apiKey.substring(0, 8) + '...' : 'none');

        // RAPIDAPI PROXY MODE: If RapidAPI is enabled and any API key is present,
        // accept it without performing MongoDB API key validation.
        if (RAPIDAPI_ENABLED && apiKey) {
          console.log('[AUTH] RapidAPI request detected');
          console.log('[AUTH] RapidAPI mode enabled - accepting API key without DB validation');
          console.log('[AUTH] API key (masked):', apiKey.substring(0, 8) + '...');

          // Create a minimal user object for RapidAPI requests
          // Uses a fixed ObjectId (no DB query needed)
          user = {
            _id: RAPIDAPI_USER_ID,
            email: RAPIDAPI_USER_EMAIL,
            name: 'RapidAPI User',
            role: 'subscriber',
            status: 'active',
            isRapidAPI: true // Flag to identify RapidAPI-sourced requests
          };
          authType = 'rapidapi';

          // Still set usage tracking headers for RapidAPI (with dummy values)
          res.setHeader('X-API-Quota-Monthly', 'unlimited');
          res.setHeader('X-API-Quota-Daily', 'unlimited');
          res.setHeader('X-API-Usage-Month', 'N/A');
          res.setHeader('X-API-Usage-Day', 'N/A');

          // Track usage in a separate collection for RapidAPI
          const Usage = require('../models/Usage');
          const startTime = Date.now();
          const yearMonth = new Date().toISOString().slice(0, 7);
          const today = new Date().getDate();

          res.on('finish', async () => {
            try {
              const responseTime = Date.now() - startTime;
              const usage = new Usage({
                apiKey: apiKey,
                userId: 'rapidapi',
                endpoint: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                responseTime,
                ip: req.ip,
                userAgent: req.get('User-Agent') || '',
                requestSize: Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8'),
                responseSize: Buffer.byteLength(JSON.stringify(res.locals.responseBody || {}), 'utf8'),
                yearMonth,
                day: today,
                isRapidAPI: true
              });
              await usage.save();
              console.log('[AUTH] RapidAPI usage tracked:', { endpoint: req.path, status: res.statusCode });
            } catch (error) {
              console.error('[AUTH] Failed to track RapidAPI usage:', error.message);
            }
          });

          return next();
        }

        // Normal API key validation (DB lookup)
        if (apiKey) {
          console.log('[AUTH] API key provided, validating against database:', apiKey.substring(0, 8) + '...');
          apiKeyDoc = await ApiKey.findOne({
            key: apiKey,
            status: 'active'
          });

          if (apiKeyDoc) {
            console.log('[AUTH] API key found in database:', { email: apiKeyDoc.email, plan: apiKeyDoc.plan });
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
              console.warn('[AUTH] Monthly quota exceeded', {
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
              console.warn('[AUTH] Daily quota exceeded', {
                apiKey: apiKey.substring(0, 8),
                email: apiKeyDoc.email,
                usage: apiKeyDoc.usageToday,
                limit: apiKeyDoc.dailyLimit
              });
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
                  console.warn('[AUTH] Rate limit exceeded', { apiKey: apiKey.substring(0, 8), count: rl.count, limit: apiKeyDoc.rateLimitPerMinute });
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
                  day: today,
                  isRapidAPI: false
                });
                await usage.save();

                // Update counters
                apiKeyDoc.usageToday += 1;
                apiKeyDoc.usageCurrentMonth += 1;
                apiKeyDoc.lastUsedAt = new Date();
                await apiKeyDoc.save();

                console.log('[AUTH] API key usage tracked:', {
                  email: apiKeyDoc.email,
                  endpoint: req.path,
                  status: res.statusCode,
                  monthUsage: `${apiKeyDoc.usageCurrentMonth}/${apiKeyDoc.monthlyLimit}`,
                  dayUsage: `${apiKeyDoc.usageToday}/${apiKeyDoc.dailyLimit}`
                });
              } catch (error) {
                console.error('[AUTH] Failed to track API usage:', error.message);
              }
            });
          } else {
            console.warn('[AUTH] Invalid API key:', apiKey.substring(0, 8) + '...');
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
        console.log('[AUTH] Authentication failed - no valid credentials provided');
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required. Provide one of:\n' +
                   '  - Authorization: Bearer <JWT_token>\n' +
                   '  - Authorization: Bearer <api_key>\n' +
                   '  - X-RapidAPI-Key: <api_key>\n' +
                   '  - X-API-Key: <api_key>'
        });
      }

      // Attach user to request object
      req.user = user;
      req.userId = user._id;
      req.authType = authType;

      console.log('[AUTH] Request authenticated:', {
        authType,
        userId: user._id,
        email: user.email,
        path: req.path
      });

      next();
    } catch (error) {
      console.error('[AUTH] Middleware error:', { error: error.message, stack: error.stack });
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
    // Skip if no user or if using API key or RapidAPI authentication (quotas handled separately)
    if (!req.user || ['api_key', 'rapidapi'].includes(req.authType)) {
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
