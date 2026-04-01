const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { success, error, buildPagination } = require('../utils/responses');
const CONSTANTS = require('../utils/constants');
const logger = require('../config/logger');

/**
 * GET /api/categories - List all categories
 * Shows system categories (user=null) + user's own categories
 */
const getCategories = async (req, res, next) => {
  try {
    const { type, active, showDeleted } = req.query;
    const page = parseInt(req.query.page) || CONSTANTS.PAGINATION.DEFAULT_PAGE;
    const limit = parseInt(req.query.limit) || CONSTANTS.PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    // Build filters - by default show system categories (user=null) + user's own
    const filters = {};

    // Filter by user: show system categories (user=null) + user's own
    if (req.userId) {
      filters.$or = [
        { user: null }, // System categories
        { user: req.userId } // User's custom categories
      ];
    } else {
      // If no user (shouldn't happen with auth middleware), only show system categories
      filters.user = null;
    }

    // By default show only non-deleted, unless explicitly requested
    if (showDeleted === 'true') {
      // Show all, including deleted
    } else {
      filters.isDeleted = false;
    }

    if (type) {
      filters.type = type;
    }

    // Handle legacy 'active' parameter (maps to !isDeleted)
    if (active !== undefined) {
      filters.isDeleted = active === 'false';
    }

    // Execute query with pagination
    const [categories, total] = await Promise.all([
      Category.find(filters)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Category.countDocuments(filters).exec()
    ]);

    const pagination = buildPagination(page, limit, total);

    const message = total === 0
      ? 'No categories found'
      : 'Categories retrieved successfully';

    return success(res, CONSTANTS.HTTP_STATUS.OK, message, categories, total > 0 ? pagination : undefined);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/:id - Get single category
 * Users can access system categories (user=null) or their own
 */
const getCategoryById = async (req, res, next) => {
  try {
    let query = { _id: req.params.id };
    if (req.userId) {
      query.$or = [
        { user: null }, // System category
        { user: req.userId } // User's own category
      ];
    }

    const category = await Category.findOne(query);

    if (!category) {
      return error(res, CONSTANTS.HTTP_STATUS.NOT_FOUND, 'NotFound', 'Category not found or access denied');
    }

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Category retrieved successfully', category);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/categories - Create new category
 * Users can create their own custom categories (user-specific)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, type, icon, color } = req.body;

    // Check if category name already exists for this user or as system category
    const existing = await Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      isDeleted: false,
      $or: [
        { user: null }, // System category with same name
        { user: req.userId } // User's own existing category
      ]
    });

    if (existing) {
      return error(res, CONSTANTS.HTTP_STATUS.CONFLICT, 'DuplicateCategory', 'A category with this name already exists');
    }

    const category = new Category({
      name: name.trim(),
      type,
      icon: icon || '',
      color: color || CONSTANTS.CATEGORY_COLORS.DEFAULT,
      user: req.userId // Category belongs to the user
    });

    await category.save();

    logger.info('Category created successfully', { categoryId: category._id, userId: req.userId, name });

    return success(res, CONSTANTS.HTTP_STATUS.CREATED, 'Category created successfully', category);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/categories/:id - Update category
 */
const updateCategory = async (req, res, next) => {
  try {
    const { name, type, icon, color } = req.body;

    // Find category that belongs to current user (system categories user=null are not editable)
    const category = await Category.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!category) {
      return error(res, CONSTANTS.HTTP_STATUS.NOT_FOUND, 'NotFound', 'Category not found or access denied');
    }

    // If name is being updated, check for duplicates among user's categories and system categories
    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        _id: { $ne: category._id },
        isDeleted: false,
        $or: [
          { user: null }, // System category with same name
          { user: req.userId } // User's own category
        ]
      });

      if (existing) {
        return error(res, CONSTANTS.HTTP_STATUS.CONFLICT, 'DuplicateCategory', 'A category with this name already exists');
      }

      category.name = name.trim();
    }

    if (type !== undefined) {
      category.type = type;
    }

    if (icon !== undefined) {
      category.icon = icon;
    }

    if (color !== undefined) {
      category.color = color;
    }

    await category.save();

    logger.info('Category updated successfully', { categoryId: category._id, userId: req.userId });

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Category updated successfully', category);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/categories/:id - Soft delete category
 */
const deleteCategory = async (req, res, next) => {
  try {
    // Find category that belongs to current user (system categories user=null cannot be deleted)
    const category = await Category.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!category) {
      return error(res, CONSTANTS.HTTP_STATUS.NOT_FOUND, 'NotFound', 'Category not found or access denied');
    }

    if (category.isDeleted) {
      return error(res, CONSTANTS.HTTP_STATUS.BAD_REQUEST, 'AlreadyDeleted', 'Category is already deleted');
    }

    // Check if category is in use by any non-deleted transactions
    const activeTransactionsCount = await Transaction.countDocuments({
      category: category._id,
      isDeleted: false
    });

    if (activeTransactionsCount > 0) {
      return error(
        res,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST,
        'CategoryInUse',
        `Cannot delete category. It is used by ${activeTransactionsCount} transaction(s).`
      );
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();

    logger.info('Category soft deleted', { categoryId: category._id, name: category.name, userId: req.userId });

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/categories - Category-wise breakdown
 */
const getCategoryAnalytics = async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;

    // Build filters
    const transactionFilters = { isDeleted: false };

    if (type) {
      transactionFilters.type = type;
    }

    if (startDate || endDate) {
      transactionFilters.date = {};
      if (startDate) {
        transactionFilters.date.$gte = new Date(startDate);
      }
      if (endDate) {
        transactionFilters.date.$lte = new Date(endDate);
      }
    }

    // Aggregate by category
    const aggregation = await Transaction.aggregate([
      { $match: transactionFilters },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get category details (non-deleted only)
    const categoryIds = aggregation.map(item => item._id);
    const categories = await Category.find({
      _id: { $in: categoryIds },
      isDeleted: false
    });
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = {
        id: cat._id,
        name: cat.name,
        color: cat.color
      };
    });

    // Build response
    const analytics = aggregation.map(item => {
      const catInfo = categoryMap[item._id.toString()] || { name: 'Unknown', color: '#000000' };
      return {
        category: {
          id: catInfo.id,
          name: catInfo.name,
          color: catInfo.color
        },
        totalAmount: item.totalAmount,
        transactionCount: item.transactionCount
      };
    });

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Category analytics retrieved successfully', analytics);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/summary - Get financial summary
 */
const getSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build filters (isDeleted: false added automatically)
    const filters = {};

    if (startDate || endDate) {
      filters.date = {};
      if (startDate) {
        filters.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.date.$lte = new Date(endDate);
      }
    }

    const [incomeResult, expenseResult] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...filters, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { ...filters, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalExpense = expenseResult[0]?.total || 0;
    const balance = totalIncome - totalExpense;

    const summary = {
      totalIncome,
      totalExpense,
      balance
    };

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Summary retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/monthly - Get monthly trends
 */
const getMonthlyTrends = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear(), months = 12 } = req.query;
    const monthCount = parseInt(months);

    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year), monthCount, 0, 23, 59, 59);

    const filters = {
      date: { $gte: startDate, $lte: endDate }
      // isDeleted: false is automatically added by pre-hook
    };

    const results = await Transaction.aggregate([
      { $match: filters },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m',
              date: '$date',
              timezone: 'UTC'
            }
          },
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
            }
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Monthly trends retrieved successfully', results);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/insights - AI-like spending insights
 * Analyzes recent spending patterns and provides recommendations
 */
const getInsights = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();

    // Default to current month if not specified
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get expenses by category for the period
    const filters = {
      date: { $gte: startDate, $lte: endDate }
      // isDeleted: false is automatically added
    };

    const expenseAggregation = await Transaction.aggregate([
      { $match: { ...filters, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    if (expenseAggregation.length === 0) {
      return success(res, CONSTANTS.HTTP_STATUS.OK, 'No expenses found for this period', {
        insights: [],
        period: `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
        totalExpenses: 0
      });
    }

    // Get category details
    const categoryIds = expenseAggregation.map(item => item._id);
    const categories = await Category.find({
      _id: { $in: categoryIds },
      isDeleted: false
    });
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat.name;
    });

    // Build category expense data
    const categoryExpenses = expenseAggregation
      .map(item => ({
        category: categoryMap[item._id.toString()] || 'Unknown',
        amount: item.totalAmount,
        count: item.transactionCount
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalExpenses = categoryExpenses.reduce((sum, cat) => sum + cat.amount, 0);
    const topCategory = categoryExpenses[0];
    const percentageOfTotal = (topCategory.amount / totalExpenses) * 100;

    // Generate insights
    const insights = [];

    // Insight 1: High spending in single category
    if (percentageOfTotal > 40) {
      insights.push({
        type: 'warning',
        title: 'High spending concentration',
        message: `You're spending ${percentageOfTotal.toFixed(1)}% of your budget on ${topCategory.category}. Consider diversifying expenses.`,
        severity: 'high'
      });
    }

    // Insight 2: Frequent small transactions
    const frequentSmallTransactions = categoryExpenses.find(
      cat => cat.count > 10 && cat.amount < 20
    );
    if (frequentSmallTransactions) {
      insights.push({
        type: 'info',
        title: 'Many small purchases',
        message: `You have ${frequentSmallTransactions.count} transactions in ${frequentSmallTransactions.category} averaging $${frequentSmallTransactions.amount.toFixed(2)}. These small purchases can add up quickly.`,
        severity: 'medium'
      });
    }

    // Insight 3: No income recorded
    const incomeResult = await Transaction.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, type: 'income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalIncome = incomeResult[0]?.total || 0;

    if (totalIncome === 0) {
      insights.push({
        type: 'warning',
        title: 'No income recorded',
        message: 'No income transactions recorded for this period. Make sure to track all your income sources.',
        severity: 'high'
      });
    } else if (totalExpenses > totalIncome * 0.8) {
      insights.push({
        type: 'warning',
        title: 'High expense ratio',
        message: `Your expenses are ${((totalExpenses / totalIncome) * 100).toFixed(1)}% of your income. Consider reviewing your spending.`,
        severity: 'high'
      });
    }

    // Insight 4: Top spending category suggestion
    insights.push({
      type: 'suggestion',
      title: 'Biggest expense category',
      message: `Your largest expense is ${topCategory.category} ($${topCategory.amount.toFixed(2)}). This is where most of your money goes.`,
      severity: 'low'
    });

    // Insight 5: Transaction frequency
    const totalTransactions = categoryExpenses.reduce((sum, cat) => sum + cat.count, 0);
    const avgPerCategory = totalTransactions / categoryExpenses.length;
    if (avgPerCategory < 3) {
      insights.push({
        type: 'info',
        title: 'Low transaction count',
        message: `You have only ${totalTransactions} expense transactions across ${categoryExpenses.length} categories. More detailed tracking can provide better insights.`,
        severity: 'low'
      });
    }

    return success(res, CONSTANTS.HTTP_STATUS.OK, 'Insights generated successfully', {
      insights,
      period: `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
      totalExpenses,
      totalIncome,
      categoryCount: categoryExpenses.length,
      transactionCount: totalTransactions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Category operations
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,

  // Analytics
  getCategoryAnalytics,
  getSummary,
  getMonthlyTrends,

  // Insights
  getInsights
};
