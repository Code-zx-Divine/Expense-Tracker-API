const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const {
  validateCategoryCreate,
  validateCategoryUpdate,
  validateCategoryIdParam,
  validateCategoryTypeQuery,
  validateActiveQuery,
  validatePagination
} = require('../utils/validators');

const asyncHandler = require('../middleware/asyncHandler');
const checkValidation = require('../utils/validators').checkValidation;

// GET /api/categories - List categories
router.get(
  '/',
  validatePagination,
  validateCategoryTypeQuery,
  validateActiveQuery,
  checkValidation,
  asyncHandler(getCategories)
);

// GET /api/categories/:id - Get single category
router.get(
  '/:id',
  validateCategoryIdParam,
  checkValidation,
  asyncHandler(getCategoryById)
);

// POST /api/categories - Create category
router.post(
  '/',
  validateCategoryCreate,
  checkValidation,
  asyncHandler(createCategory)
);

// PUT /api/categories/:id - Update category
router.put(
  '/:id',
  validateCategoryIdParam,
  validateCategoryUpdate,
  checkValidation,
  asyncHandler(updateCategory)
);

// DELETE /api/categories/:id - Soft delete category
router.delete(
  '/:id',
  validateCategoryIdParam,
  checkValidation,
  asyncHandler(deleteCategory)
);

module.exports = router;
