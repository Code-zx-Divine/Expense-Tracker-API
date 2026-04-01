const mongoose = require('mongoose');
const logger = require('../config/logger');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    type: {
      type: String,
      enum: {
        values: ['income', 'expense', 'both'],
        message: 'Type must be income, expense, or both'
      },
      required: [true, 'Category type is required']
    },
    icon: {
      type: String,
      default: '',
      maxlength: [50, 'Icon name cannot exceed 50 characters']
    },
    color: {
      type: String,
      default: '#000000',
      validate: {
        validator: function (v) {
          return /^#[0-9A-F]{6}$/i.test(v);
        },
        message: 'Color must be a valid hex color (e.g., #FF5733)'
      }
    },
    // User reference for multi-tenancy
    // null = system/category (seeded defaults) available to all users
    // ObjectId = user-created custom category
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
categorySchema.index({ user: 1, name: 1 });          // User-specific category lookup (unique per user)
categorySchema.index({ user: 1, type: 1 });         // User filter by type
categorySchema.index({ user: 1, isDeleted: 1 });   // User soft delete queries
categorySchema.index({ type: 1 });                  // Global type queries (for system categories)
categorySchema.index({ isDeleted: 1 });
categorySchema.index({ deletedAt: 1 });

// Ensure unique category names per user (system categories have user=null)
categorySchema.index({ name: 1, user: 1 }, { unique: true });

// Pre-save middleware to set deletedAt when soft deleting
categorySchema.pre('save', function (next) {
  if (this.isModified('isDeleted') && this.isDeleted) {
    this.deletedAt = new Date();
  }
  next();
});

// Method to restore (undelete) category
categorySchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

// Static method to find non-deleted categories (active)
categorySchema.statics.findActive = function () {
  return this.find({ isDeleted: false });
};

// Static method to find by type (non-deleted only)
categorySchema.statics.findByType = function (type) {
  return this.find({ type, isDeleted: false });
};

// Ensure all queries filter out deleted records
categorySchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

categorySchema.pre(/^findOne/, function (next) {
  this.where({ isDeleted: false });
  next();
});

categorySchema.pre(/^findOneAnd/, function (next) {
  this.where({ isDeleted: false });
  next();
});

/**
 * Seed default categories if none exist
 */
categorySchema.statics.seedDefaultCategories = async function () {
  try {
    const existingCount = await this.countDocuments({ isDeleted: false });

    if (existingCount === 0) {
      const defaultCategories = [
        // Income categories
        { name: 'Salary', type: 'income', icon: 'briefcase', color: '#4CAF50' },
        { name: 'Freelance', type: 'income', icon: 'laptop', color: '#8BC34A' },
        { name: 'Investment', type: 'income', icon: 'trending-up', color: '#CDDC39' },
        { name: 'Business', type: 'income', icon: 'building', color: '#009688' },
        { name: 'Other Income', type: 'income', icon: 'plus-circle', color: '#00BCD4' },

        // Expense categories
        { name: 'Food', type: 'expense', icon: 'restaurant', color: '#FF5722' },
        { name: 'Transportation', type: 'expense', icon: 'car', color: '#E91E63' },
        { name: 'Entertainment', type: 'expense', icon: 'film', color: '#9C27B0' },
        { name: 'Utilities', type: 'expense', icon: 'zap', color: '#673AB7' },
        { name: 'Healthcare', type: 'expense', icon: 'activity', color: '#3F51B5' },
        { name: 'Education', type: 'expense', icon: 'book', color: '#2196F3' },
        { name: 'Shopping', type: 'expense', icon: 'shopping-cart', color: '#03A9F4' },
        { name: 'Housing', type: 'expense', icon: 'home', color: '#00BCD4' },
        { name: 'Insurance', type: 'expense', icon: 'shield', color: '#009688' },
        { name: 'Other Expense', type: 'expense', icon: 'minus-circle', color: '#607D8B' },

        // Both type categories
        { name: 'Transfer', type: 'both', icon: 'repeat', color: '#795548' }
      ];

      await this.insertMany(defaultCategories);
      logger.info(`✅ Seeded ${defaultCategories.length} default categories`);
    }
  } catch (error) {
    logger.error('❌ Error seeding default categories:', error.message);
    throw error;
  }
};

module.exports = mongoose.model('Category', categorySchema);
