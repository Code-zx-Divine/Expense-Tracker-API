const express = require('express');
const router = express.Router();

/**
 * GET /health - Simple fallback health check endpoint
 * Always returns 200 OK to prevent Render from restarting the service
 * Note: This is a liveness check, not a readiness check
 */
router.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;