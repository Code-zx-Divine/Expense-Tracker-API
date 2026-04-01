const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List all categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - name: type
 *         in: query
 *         description: Filter by category type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [income, expense, both]
 *       - name: active
 *         in: query
 *         description: Filter by active status (true=non-deleted, false=deleted)
 *         required: false
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Categories retrieved
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
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

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get single category by ID
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Category ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// GET /api/categories/:id - Get single category
router.get(
  '/:id',
  validateCategoryIdParam,
  checkValidation,
  asyncHandler(getCategoryById)
);

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: Groceries
 *               type:
 *                 type: string
 *                 enum: [income, expense, both]
 *                 example: expense
 *               icon:
 *                 type: string
 *                 example: shopping-cart
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 example: #FF5722
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Duplicate category name
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// POST /api/categories - Create category
router.post(
  '/',
  validateCategoryCreate,
  checkValidation,
  asyncHandler(createCategory)
);

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Category ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [income, expense, both]
 *               icon:
 *                 type: string
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *     responses:
 *       200:
 *         description: Category updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Duplicate category name
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// PUT /api/categories/:id - Update category
router.put(
  '/:id',
  validateCategoryIdParam,
  validateCategoryUpdate,
  checkValidation,
  asyncHandler(updateCategory)
);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Soft delete category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Category ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot delete category in use
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// DELETE /api/categories/:id - Soft delete category
router.delete(
  '/:id',
  validateCategoryIdParam,
  checkValidation,
  asyncHandler(deleteCategory)
);

module.exports = router;
