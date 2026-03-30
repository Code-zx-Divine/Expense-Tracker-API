const rateLimit = require('express-rate-limit');
const CONSTANTS = require('../utils/constants');
const logger = require('../config/logger');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

/**
 * Rate limiter middleware
 * Preents abuse by limiting the number of requests from a single IP
 */
const rateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: CONSTANTS.MESSAGES.RATE_LIMIT_EXCEEDED
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);

    res.status(options.statusCode).json({
      success: false,
      error: 'TooManyRequests',
      message: options.message.message || CONSTANTS.MESSAGES.RATE_LIMIT_EXCEEDED,
      resetTime: new Date(Date.now() + options.windowMs).toISOString()
    });
  }
});

module.exports = rateLimiter;