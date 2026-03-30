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

// GET /api/transactions - List all transactions
router.get(
  '/',
  validatePagination,
  validateSort,
  validateDateRange,
  checkValidation,
  asyncHandler(getTransactions)
);

// GET /api/transactions/:id - Get single transaction
router.get(
  '/:id',
  validateTransactionId,
  checkValidation,
  asyncHandler(getTransactionById)
);

// PUT /api/transactions/:id - Update transaction
router.put(
  '/:id',
  validateTransactionId,
  validateTransactionUpdate,
  checkValidation,
  asyncHandler(updateTransaction)
);

// DELETE /api/transactions/:id - Soft delete transaction
router.delete(
  '/:id',
  validateTransactionId,
  checkValidation,
  asyncHandler(deleteTransaction)
);

module.exports = router;
