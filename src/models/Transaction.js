const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['income', 'expense'],
        message: 'Transaction type must be income or expense'
      },
      required: [true, 'Transaction type is required']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
      validate: {
        validator: Number.isFinite,
        message: 'Amount must be a valid number'
      }
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      validate: {
        validator: async function (value) {
          const Category = require('./Category');
          const category = await Category.findOne({
            _id: value,
            isDeleted: false,
            $or: [
              { user: null }, // System category (available to all)
              { user: this.user } // User's own category
            ]
          });
          return !!category;
        },
        message: 'Invalid, inactive, or unauthorized category'
      }
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    date: {
      type: Date,
      default: Date.now
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.user !== null; // Only require user if it's not null (allows RapidAPI)
      },
      index: true
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
transactionSchema.index({ user: 1, date: -1 });        // User transactions sorted by date (most common)
transactionSchema.index({ user: 1, category: 1 });    // User transactions by category
transactionSchema.index({ user: 1, type: 1, date: -1 }); // User filter by type + date
transactionSchema.index({ user: 1, isDeleted: 1 });  // User soft delete queries
transactionSchema.index({ user: 1, createdAt: -1 });  // User recent transactions

// Keep some global indexes for admin queries
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ category: 1, date: -1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ isDeleted: 1 });
transactionSchema.index({ createdAt: -1 });

// Pre-save middleware to set deletedAt when soft deleting
transactionSchema.pre('save', function (next) {
  if (this.isModified('isDeleted') && this.isDeleted) {
    this.deletedAt = new Date();
  }
  next();
});

// Method to restore (undelete) transaction
transactionSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

// Static method to find non-deleted transactions (active)
transactionSchema.statics.findActive = function () {
  return this.find({ isDeleted: false });
};

// Static method to find by type (non-deleted only)
transactionSchema.statics.findByType = function (type) {
  return this.find({ type, isDeleted: false });
};

// Populate category by default (only non-deleted)
transactionSchema.pre(/^find/, function (next) {
  this.populate('category', 'name type color icon');
  next();
});

// Ensure all find queries filter out deleted records
transactionSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

// Ensure all findOne queries filter out deleted records
transactionSchema.pre(/^findOne/, function (next) {
  this.where({ isDeleted: false });
  next();
});

// Also filter deleted records in findOneAndUpdate, findByIdAndUpdate, etc.
transactionSchema.pre(/^findOneAnd/, function (next) {
  this.where({ isDeleted: false });
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
