/**
 * Validation middleware that applies multiple validator chains
 * Usage:
 *   router.post('/endpoint', validate.categoryCreate, controller.createCategory)
 */
const validation = (validators) => {
  return [...validators];
};

module.exports = validation;