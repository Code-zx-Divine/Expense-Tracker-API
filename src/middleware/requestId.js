const crypto = require('crypto');

/**
 * Request ID Middleware
 * Generates a unique request ID for each incoming request
 * Useful for distributed tracing and log correlation
 */
const requestId = (req, res, next) => {
  // Check if request ID already exists (from upstream proxy like load balancer)
  const requestIdHeader = req.headers['x-request-id'] || req.headers['x-requestid'];

  if (requestIdHeader) {
    req.id = requestIdHeader;
  } else {
    // Generate cryptographically secure random ID
    req.id = crypto.randomUUID();
  }

  // Add to response headers for client tracking
  res.setHeader('X-Request-Id', req.id);

  next();
};

module.exports = requestId;
