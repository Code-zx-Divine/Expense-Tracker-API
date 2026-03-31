const ApiKey = require('../models/ApiKey');
const Usage = require('../models/Usage');
const CONSTANTS = require('../utils/constants');
const logger = require('../config/logger');

/**
 * RapidAPI authentication & quota management middleware
 * Validates API keys, checks quotas, and tracks usage
 */
const rapidApiAuth = async (req, res, next) => {
  try {
    // 1. Extract API key from headers or query params
    const apiKey = req.headers['x-rapidapi-key'] || req.query['rapidapi-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API key required. Include X-RapidAPI-Key header.',
        documentation: 'https://docs.rapidapi.com'
      });
    }

    // 2. Find API key in database
    const keyDoc = await ApiKey.findOne({ key: apiKey });

    if (!keyDoc) {
      logger.warn('Invalid API key used', { apiKey: apiKey.substring(0, 8) + '...', ip: req.ip });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Invalid API key'
      });
    }

    // 3. Check if key is active
    if (keyDoc.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `API key is ${keyDoc.status}. Contact support.`
      });
    }

    // 4. Check trial/subscription expiry
    if (keyDoc.expiresAt && keyDoc.expiresAt < new Date()) {
      keyDoc.status = 'expired';
      await keyDoc.save();
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Subscription expired. Renew to continue.',
        upgradeUrl: 'https://rapidapi.com/yourusername/expense-tracker-api'
      });
    }

    // 5. Check monthly quota
    const yearMonth = new Date().toISOString().slice(0, 7); // "2026-03"
    const today = new Date().getDate();

    // Reset counters if new month/day (handled by scheduled job ideally, but check here)
    const now = new Date();
    const lastReset = keyDoc.usageResetDate;
    if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
      keyDoc.usageCurrentMonth = 0;
      keyDoc.usageResetDate = now;
    }

    if (keyDoc.usageCurrentMonth >= keyDoc.monthlyLimit) {
      logger.warn('Monthly quota exceeded', { apiKey: apiKey.substring(0, 8), email: keyDoc.email });
      return res.status(429).json({
        success: false,
        error: 'QuotaExceeded',
        message: 'Monthly quota exceeded. Upgrade your plan.',
        quota: keyDoc.quotaInfo,
        upgradeUrl: 'https://rapidapi.com/yourusername/expense-tracker-api'
      });
    }

    // 6. Check daily quota
    if (keyDoc.usageToday >= keyDoc.dailyLimit) {
      return res.status(429).json({
        success: false,
        error: 'DailyQuotaExceeded',
        message: 'Daily quota exceeded. Please try again tomorrow.',
        quota: keyDoc.quotaInfo
      });
    }

    // 7. Simple rate limiting (in-memory for now - upgrade to Redis for production)
    const rateKey = `rate:${apiKey}`;
    if (!global.rateLimit) global.rateLimit = new Map();
    if (!global.rateLimit.has(rateKey)) {
      global.rateLimit.set(rateKey, { count: 1, reset: Date.now() + 60000 });
    } else {
      const rl = global.rateLimit.get(rateKey);
      if (Date.now() < rl.reset) {
        rl.count++;
        if (rl.count > keyDoc.rateLimitPerMinute) {
          return res.status(429).json({
            success: false,
            error: 'RateLimitExceeded',
            message: `Rate limit: ${keyDoc.rateLimitPerMinute} requests per minute`,
            retryAfter: Math.ceil((rl.reset - Date.now()) / 1000)
          });
        }
      } else {
        // Reset
        rl.count = 1;
        rl.reset = Date.now() + 60000;
      }
    }

    // 8. Attach key info to request for downstream use
    req.apiKeyData = keyDoc;
    req.apiKey = apiKey;

    // 9. Track usage after response is sent
    res.on('finish', async () => {
      try {
        const startTime = req.startTime || Date.now();
        const responseTime = Date.now() - startTime;

        // Create usage record
        const usage = new Usage({
          apiKey,
          userId: keyDoc.rapidApiUserId || null,
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

        // Update daily/monthly counters
        keyDoc.usageToday += 1;
        keyDoc.usageCurrentMonth += 1;
        keyDoc.lastUsedAt = new Date();
        await keyDoc.save();

        // Add usage headers to response
        res.setHeader('X-API-Usage-Month', `${keyDoc.usageCurrentMonth}/${keyDoc.monthlyLimit}`);
        res.setHeader('X-API-Usage-Day', `${keyDoc.usageToday}/${keyDoc.dailyLimit}`);
      } catch (error) {
        logger.error('Failed to track usage:', error.message);
      }
    });

    next();
  } catch (error) {
    logger.error('API Auth Error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Authentication failed'
    });
  }
};

module.exports = rapidApiAuth;
