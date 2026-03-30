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
          const category = await Category.findById(value);
          return category && !category.isDeleted;
        },
        message: 'Invalid or inactive category'
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
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ category: 1, date: -1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ isDeleted: 1 });
transactionSchema.index({ deletedAt: 1 });
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
