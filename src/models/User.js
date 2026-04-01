const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model
 * Handles authentication, authorization, and multi-tenancy
 *
 * Features:
 * - Email/password authentication
 * - JWT token generation & validation
 * - Password hashing with bcrypt
 * - Soft deletes
 * - User profile data
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value) {
          // Basic email regex - for production, use more comprehensive validation
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Please provide a valid email address'
      }
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Never return password in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    // User role for future permission system
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true
    },
    // Account status
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true
    },
    // Email verification
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      select: false
    },
    // Password reset
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    // JWT tokens
    lastLoginAt: {
      type: Date
    },
    lastLoginIP: {
      type: String
    },
    // API access
    apiKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    // Rate limiting per user (optional, can use Redis)
    rateLimitResetAt: {
      type: Date
    },
    rateLimitCount: {
      type: Number,
      default: 0
    },
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * Pre-save middleware to hash password on creation/modification
 */
userSchema.pre('save', async function (next) {
  // Only hash if password is modified or new
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare password method
 * @param {String} candidatePassword - Password to check
 * @returns {Promise<Boolean>} True if password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate JWT token
 * @returns {String} Signed JWT token
 */
userSchema.methods.generateAuthToken = function () {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET;
  const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const payload = {
    userId: this._id,
    email: this.email,
    role: this.role
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

/**
 * Generate API key for programmatic access
 */
userSchema.methods.generateApiKey = function () {
  const crypto = require('crypto');
  return 'exp_' + crypto.randomBytes(16).toString('hex');
};

/**
 * Check if user can make API call (rate limiting)
 */
userSchema.methods.canMakeRequest = function () {
  const now = new Date();
  const resetAt = this.rateLimitResetAt;

  // Reset counter if it's a new window (e.g., 1 hour)
  if (!resetAt || now.getTime() > resetAt.getTime()) {
    this.rateLimitCount = 0;
    this.rateLimitResetAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour window
  }

  // For now, simple count-based limiting (consider Redis for production)
  return this.rateLimitCount < 1000; // 1000 requests per hour per user
};

/**
 * Increment rate limit counter
 */
userSchema.methods.incrementRateLimit = function () {
  this.rateLimitCount += 1;
  return this.save({ validateBeforeSave: false });
};

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ apiKey: 1 });

module.exports = mongoose.model('User', userSchema);
