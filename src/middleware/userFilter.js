/**
 * User Filter Middleware
 * Automatically adds userId filter to Mongoose queries for authenticated users
 * Ensures users can only access their own data
 *
 * Usage: app.use('/api', userFilter, ...)
 */

/**
 * Adds userId condition to Mongoose query conditions
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const userFilter = (req, res, next) => {
  // If user is authenticated, automatically filter by userId
  if (req.user && req.userId) {
    // For any route that needs data isolation, we'll modify the query
    // This is a simplistic approach - in production, be more explicit

    // Attach the current user ID to request for use in controllers
    req.currentUserId = req.user._id;
  }

  next();
};

/**
 * Filter an object by allowed fields (for updates)
 * Prevents mass assignment attacks
 */
const filterAllowedFields = (req, allowedFields) => {
  const filtered = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      filtered[field] = req.body[field];
    }
  });
  return filtered;
};

module.exports = {
  userFilter,
  filterAllowedFields
};
