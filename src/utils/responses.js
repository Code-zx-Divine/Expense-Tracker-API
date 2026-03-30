const CONSTANTS = require('./constants');

/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Success message
 * @param {*} data - Response data
 * @param {Object} pagination - Optional pagination metadata
 */
const success = (res, statusCode, message, data = null, pagination = null) => {
  const response = {
    [CONSTANTS.RESPONSE_KEYS.SUCCESS]: true,
    [CONSTANTS.RESPONSE_KEYS.MESSAGE]: message
  };

  if (data !== null && data !== undefined) {
    response[CONSTANTS.RESPONSE_KEYS.DATA] = data;
  }

  if (pagination) {
    response[CONSTANTS.RESPONSE_KEYS.PAGINATION] = pagination;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} error - Error type/code
 * @param {String} message - Error message
 * @param {Object} details - Optional error details (e.g., validation errors)
 */
const error = (res, statusCode, error, message, details = null) => {
  const response = {
    [CONSTANTS.RESPONSE_KEYS.SUCCESS]: false,
    [CONSTANTS.RESPONSE_KEYS.ERROR]: error,
    [CONSTANTS.RESPONSE_KEYS.MESSAGE]: message
  };

  if (details) {
    response[CONSTANTS.RESPONSE_KEYS.DETAILS] = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Pagination metadata builder
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @param {Number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
const buildPagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    pages: totalPages
  };
};

module.exports = {
  success,
  error,
  buildPagination
};