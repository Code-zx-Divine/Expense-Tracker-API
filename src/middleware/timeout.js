/**
 * Request Timeout Middleware
 * Terminates requests that take longer than the configured timeout
 */
const timeout = (ms) => {
  return (req, res, next) => {
    res.setTimeout(ms, () => {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'RequestTimeout',
          message: 'Request timeout - server took too long to respond'
        });
      } else {
        // If headers already sent, just destroy the connection
        req.destroy();
      }
    });
    next();
  };
};

module.exports = timeout;
