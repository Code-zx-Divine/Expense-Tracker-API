const logger = require('../config/logger');
const CONSTANTS = require('../utils/constants');
const { error: errorResponse } = require('../utils/responses');

/**
 * Create error handler middleware
 * @returns {Function} Express error handling middleware
 */
const errorHandler = () => {
  const handler = (err, req, res, next) => {
    logger.error('Error occurred:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    // Determine status code and error type based on error properties
    let statusCode = CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let errorType = 'InternalServerError';
    let message = CONSTANTS.MESSAGES.INTERNAL_SERVER_ERROR;

    // Custom error classes from the application
    if (err.name === 'ValidationError') {
      statusCode = CONSTANTS.HTTP_STATUS.BAD_REQUEST;
      errorType = 'ValidationError';
      message = err.message || CONSTANTS.MESSAGES.VALIDATION_ERROR;
    } else if (err.name === 'CastError') {
      statusCode = CONSTANTS.HTTP_STATUS.BAD_REQUEST;
      errorType = 'InvalidId';
      message = CONSTANTS.MESSAGES.INVALID_ID;
    } else if (err.code === 11000) {
      statusCode = CONSTANTS.HTTP_STATUS.CONFLICT;
      errorType = 'DuplicateError';
      message = 'Resource already exists';
    } else if (err.name === 'MongoServerError' && err.code === 121) {
      statusCode = CONSTANTS.HTTP_STATUS.BAD_REQUEST;
      errorType = 'ValidationError';
      message = err.message;
    } else if (err.statusCode) {
      statusCode = err.statusCode;
      errorType = err.errorType || 'Error';
      message = err.message;
    }

    // Build error response
    const response = {
      success: false,
      error: errorType,
      message: message
    };

    // Include validation details if available
    if (err.details) {
      response.details = err.details;
    }

    // Include Mongoose validation errors
    if (err.name === 'ValidationError' && err.errors) {
      const validationDetails = {};
      Object.keys(err.errors).forEach((key) => {
        validationDetails[key] = err.errors[key].message;
      });
      response.details = validationDetails;
    }

    // Don't leak stack traces in production
    if (process.env.NODE_ENV !== 'production' && err.stack) {
      response.stack = err.stack;
    }

    return res.status(statusCode).json(response);
  };

  return handler;
};

module.exports = errorHandler;