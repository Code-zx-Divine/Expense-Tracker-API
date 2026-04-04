const express = require('express');
const router = express.Router();
const ApiKey = require('../models/ApiKey');
const { body, validationResult } = require('express-validator');
const CONSTANTS = require('../utils/constants');
const logger = require('../config/logger');

// Admin secret - MUST be set via environment variable
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  throw new Error('ADMIN_SECRET environment variable is required for admin routes');
}

// Middleware to protect admin routes
const adminAuth = (req, res, next) => {
  // DEBUG: Log what we're checking
  console.log('[DEBUG] Admin auth check:');
  console.log('[DEBUG] Expected ADMIN_SECRET:', ADMIN_SECRET ? `${ADMIN_SECRET.substring(0, 10)}...` : 'UNDEFINED');
  console.log('[DEBUG] Received header:', req.headers['x-admin-secret'] ? `${req.headers['x-admin-secret'].substring(0, 10)}...` : 'UNDEFINED');
  console.log('[DEBUG] All headers:', req.headers);

  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid admin credentials'
    });
  }
  next();
};

/**
 * @swagger
 * /admin/apikeys:
 *   post:
 *     summary: Create new API key (RapidAPI integration)
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               name:
 *                 type: string
 *                 example: John Doe
 *               plan:
 *                 type: string
 *                 enum: [free, basic, pro, enterprise]
 *                 default: free
 *               trialDays:
 *                 type: integer
 *                 minimum: 0
 *                 example: 7
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       description: The API key (only shown once)
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     plan:
 *                       type: string
 *                     quotas:
 *                       type: object
 *                       properties:
 *                         monthly:
 *                           type: integer
 *                         daily:
 *                           type: integer
 *                         rate:
 *                           type: string
 *                     trialEndsAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: API key already exists for this email
 *       401:
 *         description: Invalid admin secret
 */
router.post(
  '/apikeys',
  adminAuth,
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('name').notEmpty().withMessage('Name required'),
    body('plan').optional().isIn(['free', 'basic', 'pro', 'enterprise']),
    body('trialDays').optional().isInt({ min: 0 }).withMessage('Trial days must be non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          details: errors.mapped()
        });
      }

      const { email, name, plan = 'free', trialDays = 0 } = req.body;

      // Check if key already exists for this email
      const existing = await ApiKey.findOne({ email });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'API key already exists for this email'
        });
      }

      // Generate key
      const crypto = require('crypto');
      const key = 'exp_' + crypto.randomBytes(16).toString('hex');

      // Quotas
      const quotas = {
        free: { monthlyLimit: 100, dailyLimit: 10, rateLimitPerMinute: 10 },
        basic: { monthlyLimit: 10000, dailyLimit: 500, rateLimitPerMinute: 30 },
        pro: { monthlyLimit: 100000, dailyLimit: 5000, rateLimitPerMinute: 60 },
        enterprise: { monthlyLimit: 1000000, dailyLimit: 50000, rateLimitPerMinute: 200 }
      };
      const quota = quotas[plan] || quotas.free;

      // Dates
      const now = new Date();
      const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

      // Create
      const apiKeyDoc = new ApiKey({
        key,
        name,
        email,
        plan,
        status: 'active',
        monthlyLimit: quota.monthlyLimit,
        dailyLimit: quota.dailyLimit,
        rateLimitPerMinute: quota.rateLimitPerMinute,
        usageCurrentMonth: 0,
        usageToday: 0,
        usageResetDate: now,
        trialEndsAt,
        expiresAt: null
      });

      await apiKeyDoc.save();

      // Sync the User's apiKey field if a user with this email exists
      try {
        const User = require('../models/User');
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          existingUser.apiKey = key;
          await existingUser.save({ validateBeforeSave: false });
          console.log(`Synced User.apiKey for ${email}`);
        }
      } catch (error) {
        console.error('Failed to sync User.apiKey:', error.message);
        // Don't fail the request
      }

      return res.status(201).json({
        success: true,
        message: 'API key created successfully',
        data: {
          key,
          email,
          name,
          plan,
          quotas: {
            monthly: quota.monthlyLimit,
            daily: quota.dailyLimit,
            rateLimit: quota.rateLimitPerMinute + '/min'
          },
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          createdAt: apiKeyDoc.createdAt
        }
      });
    } catch (error) {
      logger.error('Admin API error:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to create API key'
      });
    }
  }
);

/**
 * @swagger
 * /admin/apikeys:
 *   get:
 *     summary: List API keys (admin only)
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Items per page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: plan
 *         in: query
 *         description: Filter by plan
 *         required: false
 *         schema:
 *           type: string
 *           enum: [free, basic, pro, enterprise]
 *       - name: status
 *         in: query
 *         description: Filter by status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [active, suspended, expired, cancelled]
 *     responses:
 *       200:
 *         description: API keys list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       name:
 *                         type: string
 *                       plan:
 *                         type: string
 *                       status:
 *                         type: string
 *                       usageCurrentMonth:
 *                         type: integer
 *                       usageToday:
 *                         type: integer
 *                       lastUsedAt:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Invalid admin secret
 */
/**
 * GET /admin/apikeys - List API keys (admin only)
 */
router.get('/apikeys', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, plan, status } = req.query;

    const filters = {};
    if (plan) filters.plan = plan;
    if (status) filters.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [keys, total] = await Promise.all([
      ApiKey.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-key'), // Never return full key in list
      ApiKey.countDocuments(filters)
    ]);

    res.json({
      success: true,
      data: keys,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError'
    });
  }
});

/**
 * @swagger
 * /admin/apikeys/{key}:
 *   get:
 *     summary: Get API key details
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         description: API key
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       404:
 *         description: API key not found
 *       401:
 *         description: Invalid admin secret
 */
/**
 * GET /admin/apikeys/:key - Get API key details
 */
router.get('/apikeys/:key', adminAuth, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findOne({ key: req.params.key });
    if (!keyDoc) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'API key not found'
      });
    }
    res.json({
      success: true,
      data: keyDoc
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError'
    });
  }
});

/**
 * @swagger
 * /admin/apikeys/{key}/status:
 *   put:
 *     summary: Update API key status
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         description: API key
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended, expired, cancelled]
 *     responses:
 *       200:
 *         description: API key status updated
 *         content:
 *           application/json:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Invalid status
 *       404:
 *         description: API key not found
 *       401:
 *         description: Invalid admin secret
 */
/**
 * PUT /admin/apikeys/:key/status - Update API key status
 */
router.put('/apikeys/:key/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'expired', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid status. Must be: active, suspended, expired, cancelled'
      });
    }

    const keyDoc = await ApiKey.findOneAndUpdate(
      { key: req.params.key },
      { status },
      { new: true, select: '-key' }
    );

    if (!keyDoc) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key status updated',
      data: keyDoc
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError'
    });
  }
});

/**
 * @swagger
 * /admin/apikeys/{key}:
 *   delete:
 *     summary: Revoke API key
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         description: API key to revoke
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: API key not found
 *       401:
 *         description: Invalid admin secret
 */
/**
 * DELETE /admin/apikeys/:key - Revoke API key
 */
router.delete('/apikeys/:key', adminAuth, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findOneAndDelete({ key: req.params.key });
    if (!keyDoc) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError'
    });
  }
});

/**
 * @swagger
 * /admin/stats/usage:
 *   get:
 *     summary: Usage statistics
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - name: month
 *         in: query
 *         description: Month in YYYY-MM format (defaults to current month)
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9]{4}-[0-9]{2}$'
 *     responses:
 *       200:
 *         description: Usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                       example: "2024-01"
 *                     totalCalls:
 *                       type: integer
 *                     topKeys:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                           name:
 *                             type: string
 *                           plan:
 *                             type: string
 *                           usageCurrentMonth:
 *                             type: integer
 *                           monthlyLimit:
 *                             type: integer
 *                           percentUsed:
 *                             type: number
 *                     callsByEndpoint:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           calls:
 *                             type: integer
 *                     statusCodes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: integer
 *                           count:
 *                             type: integer
 *       401:
 *         description: Invalid admin secret
 */
/**
 * GET /admin/stats - Usage statistics
 */
router.get('/stats/usage', adminAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const yearMonth = month || new Date().toISOString().slice(0, 7);

    // Total API calls this month
    const totalCalls = await Usage.countDocuments({ yearMonth });

    // Top API keys by usage
    const topKeys = await ApiKey.aggregate([
      { $sort: { usageCurrentMonth: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          email: 1,
          name: 1,
          plan: 1,
          usageCurrentMonth: 1,
          monthlyLimit: 1,
          percentUsed: { $multiply: [{ $divide: ['$usageCurrentMonth', '$monthlyLimit'] }, 100] }
        }
      }
    ]);

    // Calls by endpoint
    const callsByEndpoint = await Usage.aggregate([
      { $match: { yearMonth } },
      { $group: { _id: '$endpoint', calls: { $sum: 1 } } },
      { $sort: { calls: -1 } },
      { $limit: 10 }
    ]);

    // Status code distribution
    const statusCodes = await Usage.aggregate([
      { $match: { yearMonth } },
      { $group: { _id: '$statusCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: yearMonth,
        totalCalls,
        topKeys,
        callsByEndpoint,
        statusCodes
      }
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError'
    });
  }
});

module.exports = router;
