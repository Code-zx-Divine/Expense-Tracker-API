const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { validationResult } = require('express-validator');
const crypto = require('crypto');

/**
 * Register a new user
 * POST /auth/register
 */
exports.register = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: errors.mapped()
      });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    // Generate API key
    const apiKeyValue = 'exp_' + crypto.randomBytes(16).toString('hex');

    // Create user
    const user = new User({
      email,
      password,
      name,
      apiKey: apiKeyValue
    });

    await user.save();

    // Also create an ApiKey document for proper quota tracking
    // This allows the API key to work with the auth middleware
    try {
      const apiKeyDoc = new ApiKey({
        key: apiKeyValue,
        email: user.email,
        name: user.name,
        plan: 'free', // Default plan for registered users
        status: 'active',
        monthlyLimit: 100,
        dailyLimit: 10,
        rateLimitPerMinute: 10,
        usageCurrentMonth: 0,
        usageToday: 0
      });
      await apiKeyDoc.save();
      console.log(`Created ApiKey document for user ${user.email}`);
    } catch (error) {
      // Don't fail registration if ApiKey creation fails, but log it
      console.error('Failed to create ApiKey document:', error.message);
    }

    // Generate JWT token
    const token = user.generateAuthToken();

    // Log successful registration
    const logger = require('../config/logger');
    logger.info('User registered', { userId: user._id, email: user.email });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          apiKey: user.apiKey,
          createdAt: user.createdAt
        },
        token
      }
    });
  } catch (error) {
    // Handle duplicate key errors (should be caught above but just in case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    // Validation errors from schema
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }

    logger = require('../config/logger');
    logger.error('Registration error:', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to register user'
    });
  }
};

/**
 * User login
 * POST /auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: errors.mapped()
      });
    }

    const { email, password } = req.body;

    // Find user with password field included
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Account is ${user.status}. Contact support.`
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Update login tracking
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save({ validateBeforeSave: false });

    // Ensure ApiKey document exists for this user (for auth middleware)
    if (user.apiKey) {
      try {
        let apiKeyDoc = await ApiKey.findOne({ key: user.apiKey });
        if (!apiKeyDoc) {
          apiKeyDoc = new ApiKey({
            key: user.apiKey,
            email: user.email,
            name: user.name,
            plan: 'free',
            status: 'active',
            monthlyLimit: 100,
            dailyLimit: 10,
            rateLimitPerMinute: 10
          });
          await apiKeyDoc.save();
          console.log(`Created missing ApiKey document for ${user.email} during login`);
        }
      } catch (error) {
        console.error('Failed to ensure ApiKey document exists:', error.message);
      }
    }

    // Generate JWT token
    const token = user.generateAuthToken();

    const logger = require('../config/logger');
    logger.info('User logged in', { userId: user._id, email: user.email, ip: req.ip });

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          apiKey: user.apiKey,
          lastLoginAt: user.lastLoginAt
        },
        token
      }
    });
  } catch (error) {
    const logger = require('../config/logger');
    logger.error('Login error:', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to login'
    });
  }
};

/**
 * Refresh JWT token (requires valid refresh token in future implementation)
 * POST /auth/refresh
 */
exports.refresh = async (req, res, next) => {
  try {
    // In a full implementation, you'd have refresh tokens stored
    // For now, just issue a new token if the user is authenticated
    const user = req.user; // Set by auth middleware

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Not authenticated'
      });
    }

    // Generate new token
    const token = user.generateAuthToken();

    return res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    const logger = require('../config/logger');
    logger.error('Token refresh error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to refresh token'
    });
  }
};

/**
 * Get current user profile
 * GET /auth/me
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = req.user; // Set by auth middleware

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.status,
          apiKey: user.apiKey,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      }
    });
  } catch (error) {
    const logger = require('../config/logger');
    logger.error('Get profile error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to get profile'
    });
  }
};

/**
 * Update user profile
 * PUT /auth/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const user = req.user;

    // Update allowed fields
    if (name) user.name = name;

    await user.save();

    const logger = require('../config/logger');
    logger.info('User profile updated', { userId: user._id });

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
  } catch (error) {
    const logger = require('../config/logger');
    logger.error('Update profile error:', error.message);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }

    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to update profile'
    });
  }
};

/**
 * Change password
 * PUT /auth/password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: errors.mapped()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    const logger = require('../config/logger');
    logger.info('Password changed', { userId: user._id });

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    const logger = require('../config/logger');
    logger.error('Change password error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to change password'
    });
  }
};
