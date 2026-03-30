module.exports = {
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },

  // Transaction types
  TRANSACTION_TYPES: {
    INCOME: 'income',
    EXPENSE: 'expense'
  },

  // Default category colors
  CATEGORY_COLORS: {
    INCOME: '#4CAF50',
    EXPENSE: '#F44336',
    DEFAULT: '#2196F3'
  },

  // Default pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // Sort options
  SORT: {
    DEFAULT_FIELD: 'date',
    DEFAULT_ORDER: 'desc',
    VALID_FIELDS: ['date', 'amount', 'createdAt'],
    ORDERS: ['asc', 'desc']
  },

  // Error messages
  MESSAGES: {
    SUCCESS: 'Operation completed successfully',
    NOT_FOUND: 'Resource not found',
    INVALID_ID: 'Invalid ID format',
    VALIDATION_ERROR: 'Validation failed',
    DATABASE_ERROR: 'Database operation failed',
    RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later'
  },

  // Response keys
  RESPONSE_KEYS: {
    SUCCESS: 'success',
    MESSAGE: 'message',
    DATA: 'data',
    ERROR: 'error',
    DETAILS: 'details',
    PAGINATION: 'pagination'
  }
};