const mongoose = require('mongoose');

/**
 * API Key management model for RapidAPI monetization
 * Each document represents a subscriber with quota limits
 */
const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true
    },
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      required: true,
      default: 'free',
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'expired', 'cancelled'],
      default: 'active',
      index: true
    },
    // Quota limits (monthly)
    monthlyLimit: {
      type: Number,
      required: true,
      default: 100
    },
    dailyLimit: {
      type: Number,
      required: true,
      default: 10
    },
    // Rate limits (requests per minute)
    rateLimitPerMinute: {
      type: Number,
      required: true,
      default: 30
    },
    // Usage tracking (cached counters for performance)
    usageCurrentMonth: {
      type: Number,
      default: 0
    },
    usageToday: {
      type: Number,
      default: 0
    },
    usageResetDate: {
      type: Date,
      default: Date.now
    },
    // Subscription dates
    expiresAt: {
      type: Date,
      index: true
    },
    trialEndsAt: {
      type: Date,
      index: true
    },
    // Billing info
    rapidApiUserId: {
      type: String,
      default: null
    },
    rapidApiSubscriptionId: {
      type: String,
      default: null
    },
    // Metadata
    notes: {
      type: String,
      default: ''
    },
    lastUsedAt: {
      type: Date,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Generate random API key
apiKeySchema.pre('validate', function (next) {
  if (!this.key) {
    this.key = 'exp_' + require('crypto').randomBytes(16).toString('hex');
  }
  next();
});

// Check if trial is active
apiKeySchema.virtual('isTrialActive').get(function () {
  return this.trialEndsAt && this.trialEndsAt > new Date();
});

// Check if subscription is active
apiKeySchema.virtual('isActive').get(function () {
  return (
    this.status === 'active' &&
    (!this.expiresAt || this.expiresAt > new Date())
  );
});

// Format quotas for response
apiKeySchema.virtual('quotaInfo').get(function () {
  return {
    plan: this.plan,
    monthlyLimit: this.monthlyLimit,
    used: this.usageCurrentMonth,
    remaining: this.monthlyLimit - this.usageCurrentMonth,
    dailyLimit: this.dailyLimit,
    dailyUsed: this.usageToday,
    dailyRemaining: this.dailyLimit - this.usageToday
  };
});

module.exports = mongoose.model('ApiKey', apiKeySchema);
