const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { success, error, buildPagination } = require('../utils/responses');
const CONSTANTS = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Build query filters from request query parameters
 * Note: isDeleted: false is automatically applied via model pre-hook
 * Automatically filters by current user (multi-tenancy)
 */
const buildTransactionFilters = (query, req) => {
  const filters = {};

  // Always filter by authenticated user
  // req.currentUserId is set by userFilter middleware
  if (req.currentUserId) {
    filters.user = req.currentUserId;
  }

  if (query.type) {
    filters.type = query.type;
  }

  if (query.category) {
    filters.category = query.category;
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    filters.date = {};
    if (query.startDate) {
      filters.date.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      filters.date.$lte = new Date(query.endDate);
    }
  }

  return filters;
};

/**
 * Build sort options from query parameters
 */
const buildSortOptions = (query) => {
  const sortBy = query.sortBy && CONSTANTS.SORT.VALID_FIELDS.includes(query.sortBy)
    ? query.sortBy
    : CONSTANTS.SORT.DEFAULT_FIELD;

  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  return { [sortBy]: sortOrder };
};

/**
 * POST /api/transactions/expense - Add new expense
 */
const addExpense = async (req, res, next) => {
  try {
    const { amount, category, description, date } = req.body;

    // Verify category exists, is not deleted, and belongs to user or is system category
    const categoryDoc = await Category.findOne({
      _id: category,
      isDeleted: false,
      $or: [
        { user: null }, // System category
        { user: req.userId } // User's own category
      ]
    });

    if (!categoryDoc) {
      return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategory', 'Invalid, inactive, or unauthorized category');
    }

    if (!['expense', 'both'].includes(categoryDoc.type)) {
      return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategoryType', 'Category must be an expense type');
    }

    const transaction = new Transaction({
      type: 'expense',
      amount: parseFloat(amount),
      category,
      description: description || '',
      date: date ? new Date(date) : undefined,
      user: req.userId // Set the user
    });

    await transaction.save();

    logger.info('Expense added successfully', { transactionId: transaction._id, userId: req.userId, amount });

    return success(res, CONSTANTS.HTTP_STATUS.CREATED, 'Expense added successfully', transaction);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/transactions/income - Add new income
 */
const addIncome = async (req, res, next) => {
  try {
    const { amount, category, description, date } = req.body;

    // Verify category exists, is not deleted, and belongs to user or is system category
    const categoryDoc = await Category.findOne({
      _id: category,
      isDeleted: false,
      $or: [
        { user: null }, // System category
        { user: req.userId } // User's own category
      ]
    });

    if (!categoryDoc) {
      return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategory', 'Invalid, inactive, or unauthorized category');
    }

    if (!['income', 'both'].includes(categoryDoc.type)) {
      return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategoryType', 'Category must be an income type');
    }

    const transaction = new Transaction({
      type: 'income',
      amount: parseFloat(amount),
      category,
      description: description || '',
      date: date ? new Date(date) : undefined,
      user: req.userId // Set the user
    });

    await transaction.save();

    logger.info('Income added successfully', { transactionId: transaction._id, userId: req.userId, amount });

    return success(res, CONSTANTS.HTTP_STATUS.CREATED, 'Income added successfully', transaction);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/transactions - List all transactions with filters and pagination
 */
const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || CONSTANTS.PAGINATION.DEFAULT_PAGE;
    const limit = parseInt(req.query.limit) || CONSTANTS.PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    // Build filters (isDeleted: false added automatically via pre-hook)
    const filters = buildTransactionFilters(req.query, req); // Pass req to include user filter

    // Build sort options
    const sort = buildSortOptions(req.query);

    // Execute query with pagination
    const [transactions, total] = await Promise.all([
      Transaction.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      Transaction.countDocuments(filters).exec()
    ]);

    const pagination = buildPagination(page, limit, total);

    const message = total === 0
      ? 'No transactions found'
      : 'Transactions retrieved successfully';

    return success(res, CONSTANTS.HTTP_STATUS.OK, message, transactions, total > 0 ? pagination : undefined);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/transactions/:id - Get single transaction
 */
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.userId // Ensure user owns this transaction
    });

    if (!transaction) {
      return error(res, CONSTANTS.HTTP_STATUS.NOT_FOUND, 'NotFound', 'Transaction not found or access denied');
    }

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Transaction retrieved successfully', transaction);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/transactions/:id - Update transaction
 */
const updateTransaction = async (req, res, next) => {
  try {
    const { amount, category, description, date } = req.body;

    // Find transaction that belongs to current user
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!transaction) {
      return error(res, CONSTANTS.HTTP_STATUS.NOT_FOUND, 'NotFound', 'Transaction not found or access denied');
    }

    // If category is being updated, verify it's valid, not deleted, and belongs to user or is system category
    if (category && category !== transaction.category.toString()) {
      const categoryDoc = await Category.findOne({
        _id: category,
        isDeleted: false,
        $or: [
          { user: null }, // System category
          { user: req.userId } // User's own category
        ]
      });

      if (!categoryDoc) {
        return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategory', 'Invalid, inactive, or unauthorized category');
      }

      if (transaction.type === 'expense' && !['expense', 'both'].includes(categoryDoc.type)) {
        return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategoryType', 'Expense must use an expense category');
      }

      if (transaction.type === 'income' && !['income', 'both'].includes(categoryDoc.type)) {
        return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'InvalidCategoryType', 'Income must use an income category');
      }

      transaction.category = category;
    }

    // Update other fields
    if (amount !== undefined) {
      transaction.amount = parseFloat(amount);
    }

    if (description !== undefined) {
      transaction.description = description;
    }

    if (date !== undefined) {
      transaction.date = new Date(date);
    }

    await transaction.save();

    logger.info('Transaction updated successfully', { transactionId: transaction._id, userId: req.userId });

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Transaction updated successfully', transaction);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/transactions/:id - Soft delete transaction
 */
const deleteTransaction = async (req, res, next) => {
  try {
    // Find transaction that belongs to current user
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!transaction) {
      return error(res, CONSTANTS.HTTP_STATUS.NOT_FOUND, 'NotFound', 'Transaction not found or access denied');
    }

    transaction.isDeleted = true;
    transaction.deletedAt = new Date();
    await transaction.save();

    logger.info('Transaction soft deleted', { transactionId: transaction._id, userId: req.userId });

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Transaction deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addExpense,
  addIncome,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction
};
