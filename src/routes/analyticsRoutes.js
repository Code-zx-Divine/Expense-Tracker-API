const express = require('express');
const router = express.Router();
const {
  getCategoryAnalytics,
  getSummary,
  getMonthlyTrends,
  getInsights
} = require('../controllers/categoryController');

/**
 * @swagger
 * /analytics/categories:
 *   get:
 *     summary: Category-wise spending breakdown
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         description: Filter by transaction type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *       - $ref: '#/components/parameters/startDateParam'
 *       - $ref: '#/components/parameters/endDateParam'
 *     responses:
 *       200:
 *         description: Category analytics retrieved
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
 *                       category:
 *                         $ref: '#/components/schemas/Category'
 *                       totalAmount:
 *                         type: number
 *                       transactionCount:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
const {
  validateCategoryTypeQuery,
  validateDateRange,
  checkValidation
} = require('../utils/validators');

const asyncHandler = require('../middleware/asyncHandler');

/**
 * @swagger
 * /analytics/summary:
 *   get:
 *     summary: Financial summary (total income, expenses, balance)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/startDateParam'
 *       - $ref: '#/components/parameters/endDateParam'
 *     responses:
 *       200:
 *         description: Summary retrieved
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
 *                     totalIncome:
 *                       type: number
 *                     totalExpense:
 *                       type: number
 *                     balance:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// GET /api/analytics/summary - Financial summary
router.get(
  '/summary',
  validateDateRange,
  checkValidation,
  asyncHandler(getSummary)
);

/**
 * @swagger
 * /analytics/monthly:
 *   get:
 *     summary: Monthly trends (income vs expenses over time)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: year
 *         in: query
 *         description: Year (defaults to current year)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *       - name: months
 *         in: query
 *         description: Number of months to include (defaults to 12)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     responses:
 *       200:
 *         description: Monthly trends retrieved
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
 *                         example: "2024-01"
 *                       income:
 *                         type: number
 *                       expense:
 *                         type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// GET /api/analytics/monthly - Monthly trends
router.get(
  '/monthly',
  checkValidation,
  asyncHandler(getMonthlyTrends)
);

/**
 * @swagger
 * /analytics/insights:
 *   get:
 *     summary: AI-powered spending insights and recommendations
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: month
 *         in: query
 *         description: Month number (1-12, defaults to current)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *       - name: year
 *         in: query
 *         description: Year (defaults to current)
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Insights generated
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
 *                     insights:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [warning, info, suggestion]
 *                           title:
 *                             type: string
 *                           message:
 *                             type: string
 *                           severity:
 *                             type: string
 *                             enum: [high, medium, low]
 *                     period:
 *                       type: string
 *                       example: "2024-01"
 *                     totalExpenses:
 *                       type: number
 *                     totalIncome:
 *                       type: number
 *                     categoryCount:
 *                       type: integer
 *                     transactionCount:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// GET /api/insights - AI-like spending insights
router.get(
  '/insights',
  checkValidation,
  asyncHandler(getInsights)
);

module.exports = router;
