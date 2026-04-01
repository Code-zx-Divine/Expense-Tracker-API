const express = require('express');
const router = express.Router();
const {
  addExpense,
  addIncome,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactionController');

/**
 * @swagger
 * /transactions/expense:
 *   post:
 *     summary: Add a new expense
 *     tags: [Transactions]
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
 *               - amount
 *               - category
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 45.99
 *               category:
 *                 type: string
 *                 description: Category ID (must be expense type or user's own category)
 *                 example: 60d21b4667d0d8992e610c85
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Lunch at cafe
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-15T12:00:00Z
 *     responses:
 *       201:
 *         description: Expense created
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
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
const {
  validateTransactionCreate,
  validateTransactionUpdate,
  validateTransactionId,
  validatePagination,
  validateSort,
  validateDateRange,
  checkValidation
} = require('../utils/validators');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @swagger
 * /transactions/income:
 *   post:
 *     summary: Add a new income
 *     tags: [Transactions]
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
 *               - amount
 *               - category
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 1500.00
 *               category:
 *                 type: string
 *                 description: Category ID (must be income type or both type)
 *                 example: 60d21b4667d0d8992e610c85
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Freelance payment
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-15T12:00:00Z
 *     responses:
 *       201:
 *         description: Income created
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
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// POST /api/transactions/expense - Add expense
router.post(
  '/expense',
  validateTransactionCreate,
  checkValidation,
  asyncHandler(addExpense)
);

// POST /api/transactions/income - Add income
router.post(
  '/income',
  validateTransactionCreate,
  checkValidation,
  asyncHandler(addIncome)
);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: List all transactions with filters
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/sortByParam'
 *       - $ref: '#/components/parameters/sortOrderParam'
 *       - $ref: '#/components/parameters/startDateParam'
 *       - $ref: '#/components/parameters/endDateParam'
 *       - name: type
 *         in: query
 *         description: Filter by transaction type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *       - name: category
 *         in: query
 *         description: Filter by category ID
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transactions retrieved
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
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// GET /api/transactions - List all transactions
router.get(
  '/',
  validatePagination,
  validateSort,
  validateDateRange,
  checkValidation,
  asyncHandler(getTransactions)
);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get single transaction by ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Transaction ID (MongoDB ObjectId)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction retrieved
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
 *                   $ref: '#/components/schemas/Transaction'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// GET /api/transactions/:id - Get single transaction
router.get(
  '/:id',
  validateTransactionId,
  checkValidation,
  asyncHandler(getTransactionById)
);

/**
 * @swagger
 * /transactions/{id}:
 *   put:
 *     summary: Update transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Transaction ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - category
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Transaction updated
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
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// PUT /api/transactions/:id - Update transaction
router.put(
  '/:id',
  validateTransactionId,
  validateTransactionUpdate,
  checkValidation,
  asyncHandler(updateTransaction)
);

/**
 * @swagger
 * /transactions/{id}:
 *   delete:
 *     summary: Soft delete transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Transaction ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction deleted
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
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
// DELETE /api/transactions/:id - Soft delete transaction
router.delete(
  '/:id',
  validateTransactionId,
  checkValidation,
  asyncHandler(deleteTransaction)
);

module.exports = router;
