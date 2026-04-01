const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *                 database:
 *                   type: object
 *                   properties:
 *                     state:
 *                       type: string
 *                     connected:
 *                       type: boolean
 *                     name:
 *                       type: string
 *                 memory:
 *                   type: object
 *                   properties:
 *                     rss:
 *                       type: string
 *                     heapTotal:
 *                       type: string
 *                     heapUsed:
 *                       type: string
 *                     external:
 *                       type: string
 *                 environment:
 *                   type: string
 *       503:
 *         description: Service degraded
 */
/**
 * GET /health - Comprehensive health check
 * Returns service health, database status, and system metrics
 * Mounted at: /health (in app.js)
 */
router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const memoryUsage = process.memoryUsage();
  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      state: dbStates[dbState] || 'unknown',
      connected: dbState === 1,
      name: mongoose.connection.name || 'expense-tracker'
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
