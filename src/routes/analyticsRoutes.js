const express = require('express');
const router = express.Router();
const {
  getCategoryAnalytics,
  getSummary,
  getMonthlyTrends,
  getInsights
} = require('../controllers/categoryController');
const {
  validateCategoryTypeQuery,
  validateDateRange,
  checkValidation
} = require('../utils/validators');

const asyncHandler = require('../middleware/asyncHandler');

// GET /api/analytics/categories - Category-wise analytics
router.get(
  '/categories',
  validateCategoryTypeQuery,
  validateDateRange,
  checkValidation,
  asyncHandler(getCategoryAnalytics)
);

// GET /api/analytics/summary - Financial summary
router.get(
  '/summary',
  validateDateRange,
  checkValidation,
  asyncHandler(getSummary)
);

// GET /api/analytics/monthly - Monthly trends
router.get(
  '/monthly',
  checkValidation,
  asyncHandler(getMonthlyTrends)
);

// GET /api/insights - AI-like spending insights
router.get(
  '/insights',
  checkValidation,
  asyncHandler(getInsights)
);

module.exports = router;
