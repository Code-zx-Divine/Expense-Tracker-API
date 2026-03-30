/**
 * Async handler wrapper
 * Wraps async route handlers and forwards errors to the error handling middleware
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function with error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;