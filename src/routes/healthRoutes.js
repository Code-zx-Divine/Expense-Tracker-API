const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * GET /health - Health check endpoint
 * Returns service status and database connectivity
 */
router.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection state
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      connected: dbState === 1,
      state: dbState === 1 ? 'connected' : 'disconnected'
    };

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development'
    };

    const statusCode = dbStatus.connected ? 200 : 503;

    return res.status(statusCode).json({
      success: true,
      ...health
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;