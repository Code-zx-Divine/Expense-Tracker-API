const { body, param, query, validationResult } = require('express-validator');
const CONSTANTS = require('./constants');

/**
 * Validation middleware wrapper
 * Handles validation results and forwards to error handler
 */
const validate = (validators) => {
  return validators;
};

// Transaction validators

const validateTransactionAmount = [
  body('amount')
    .exists()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0')
];

const validateCategoryId = [
  body('category')
    .exists()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage(CONSTANTS.MESSAGES.INVALID_ID)
];

const validateTransactionType = [
  body('type')
    .exists()
    .withMessage('Transaction type is required')
    .isIn([CONSTANTS.TRANSACTION_TYPES.INCOME, CONSTANTS.TRANSACTION_TYPES.EXPENSE])
    .withMessage('Transaction type must be income or expense')
];

const validateTransactionDescription = [
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

const validateTransactionDate = [
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO date string')
];

const validateTransactionCreate = [
  ...validateTransactionType,
  ...validateTransactionAmount,
  ...validateCategoryId,
  ...validateTransactionDescription,
  ...validateTransactionDate
];

const validateTransactionUpdate = [
  ...validateTransactionAmount,
  ...validateCategoryId,
  ...validateTransactionDescription,
  ...validateTransactionDate
];

// Category validators

const validateCategoryName = [
  body('name')
    .exists()
    .withMessage('Category name is required')
    .isString()
    .withMessage('Category name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters')
];

const validateCategoryType = [
  body('type')
    .exists()
    .withMessage('Category type is required')
    .isIn(['income', 'expense', 'both'])
    .withMessage('Category type must be income, expense, or both')
];

const validateCategoryColor = [
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color (e.g., #FF5733)')
];

const validateCategoryIcon = [
  body('icon')
    .optional()
    .isString()
    .withMessage('Icon must be a string')
    .isLength({ max: 50 })
    .withMessage('Icon name cannot exceed 50 characters')
];

const validateCategoryCreate = [
  ...validateCategoryName,
  ...validateCategoryType,
  ...validateCategoryColor,
  ...validateCategoryIcon
];

const validateCategoryUpdate = [
  ...validateCategoryName,
  ...validateCategoryType,
  ...validateCategoryColor,
  ...validateCategoryIcon
];

// Query validators

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: CONSTANTS.PAGINATION.MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${CONSTANTS.PAGINATION.MAX_LIMIT}`)
];

const validateSort = [
  query('sortBy')
    .optional()
    .isIn(CONSTANTS.SORT.VALID_FIELDS)
    .withMessage(`Sort field must be one of: ${CONSTANTS.SORT.VALID_FIELDS.join(', ')}`),
  query('sortOrder')
    .optional()
    .isIn(CONSTANTS.SORT.ORDERS)
    .withMessage(`Sort order must be asc or desc`)
];

const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO date string'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO date string')
];

const validateCategoryTypeQuery = [
  query('type')
    .optional()
    .isIn(['income', 'expense', 'both'])
    .withMessage('Category type filter must be income, expense, or both')
];

const validateActiveQuery = [
  query('active')
    .optional()
    .isBoolean()
    .withMessage('Active filter must be true or false')
];

// ID param validators

const validateTransactionId = [
  param('id')
    .isMongoId()
    .withMessage(CONSTANTS.MESSAGES.INVALID_ID)
];

const validateCategoryIdParam = [
  param('id')
    .isMongoId()
    .withMessage(CONSTANTS.MESSAGES.INVALID_ID)
];

// Utility to check validation results
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.mapped();
    const formattedErrors = Object.keys(errorDetails).reduce((acc, key) => {
      acc[key] = errorDetails[key].msg;
      return acc;
    }, {});

    return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'ValidationError',
      message: 'Invalid input data',
      details: formattedErrors
    });
  }
  next();
};

module.exports = {
  // Transaction validators
  validateTransactionCreate,
  validateTransactionUpdate,
  validateTransactionId,

  // Category validators
  validateCategoryCreate,
  validateCategoryUpdate,
  validateCategoryIdParam,
  validateCategoryTypeQuery,
  validateActiveQuery,

  // Query validators
  validatePagination,
  validateSort,
  validateDateRange,

  // Shared
  checkValidation
};
