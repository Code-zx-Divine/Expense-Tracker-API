const mongoose = require('mongoose');

/**
 * Usage tracking model for API monetization
 * Tracks every API call per API key for billing & analytics
 */
const usageSchema = new mongoose.Schema(
  {
    apiKey: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      default: null,
      index: true
    },
    endpoint: {
      type: String,
      required: true,
      index: true
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
      required: true
    },
    statusCode: {
      type: Number,
      required: true,
      index: true
    },
    responseTime: {
      type: Number,
      default: 0
    },
    ip: {
      type: String,
      required: true,
      index: true
    },
    userAgent: {
      type: String,
      default: ''
    },
    requestSize: {
      type: Number,
      default: 0
    },
    responseSize: {
      type: Number,
      default: 0
    },
    // Monthly/day tracking for quotas
    yearMonth: {
      type: String,
      required: true,
      index: true
    },
    day: {
      type: Number,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for faster queries
usageSchema.index({ apiKey: 1, createdAt: -1 });
usageSchema.index({ apiKey: 1, yearMonth: 1 });
usageSchema.index({ apiKey: 1, day: 1 });

module.exports = mongoose.model('Usage', usageSchema);
