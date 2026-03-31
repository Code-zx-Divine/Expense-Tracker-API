#!/usr/bin/env node

/**
 * Admin utility to create API keys for RapidAPI users
 * Usage: node src/scripts/create-api-key.js --email user@example.com --name "User Name" --plan basic
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ApiKey = require('../models/ApiKey');
const crypto = require('crypto');

async function createApiKey({ email, name, plan = 'free', trialDays = 0 }) {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Generate API key
    const key = 'exp_' + crypto.randomBytes(16).toString('hex');

    // Set quotas based on plan
    const quotas = {
      free: { monthlyLimit: 100, dailyLimit: 10, rateLimitPerMinute: 10 },
      basic: { monthlyLimit: 10000, dailyLimit: 500, rateLimitPerMinute: 30 },
      pro: { monthlyLimit: 100000, dailyLimit: 5000, rateLimitPerMinute: 60 },
      enterprise: { monthlyLimit: 1000000, dailyLimit: 50000, rateLimitPerMinute: 200 }
    };

    const quota = quotas[plan] || quotas.free;

    // Calculate dates
    const now = new Date();
    const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

    // Create API key document
    const apiKeyDoc = new ApiKey({
      key,
      name,
      email,
      plan,
      status: 'active',
      monthlyLimit: quota.monthlyLimit,
      dailyLimit: quota.dailyLimit,
      rateLimitPerMinute: quota.rateLimitPerMinute,
      usageCurrentMonth: 0,
      usageToday: 0,
      usageResetDate: now,
      trialEndsAt,
      expiresAt: null // Set based on billing cycle if needed
    });

    await apiKeyDoc.save();

    console.log('\n🎉 API Key Created Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email:        ${email}`);
    console.log(`👤 Name:         ${name}`);
    console.log(`💳 Plan:         ${plan.toUpperCase()}`);
    console.log(`🔢 Key:          ${key}`);
    console.log(`📊 Monthly Quota: ${quota.monthlyLimit.toLocaleString()} requests`);
    console.log(`📊 Daily Quota:   ${quota.dailyLimit.toLocaleString()} requests`);
    console.log(`⚡ Rate Limit:    ${quota.rateLimitPerMinute} req/min`);
    if (trialEndsAt) {
      console.log(`🎁 Trial ends:    ${trialEndsAt.toLocaleDateString()}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Instruct user to include this header:');
    console.log(`   X-RapidAPI-Key: ${key}\n`);
    console.log('🔗 API Base URL:');
    console.log(`   https://your-api.onrender.com\n`);

    // Also print JSON for API response
    console.log('📋 Response JSON:');
    console.log(JSON.stringify({
      success: true,
      message: 'API key created',
      data: {
        key,
        email,
        name,
        plan,
        quotas: {
          monthly: quota.monthlyLimit,
          daily: quota.dailyLimit,
          rateLimit: quota.rateLimitPerMinute + '/min'
        },
        trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null
      }
    }, null, 2));

    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('💡 An API key already exists for this email.');
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const params = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  const value = args[i + 1];
  if (key && value) {
    params[key] = value;
  }
}

if (!params.email || !params.name) {
  console.log('Usage: node src/scripts/create-api-key.js --email user@example.com --name "User Name" [--plan basic] [--trial 7]');
  console.log('\nPlans: free, basic ($19/mo), pro ($49/mo), enterprise');
  process.exit(1);
}

createApiKey(params).catch(console.error);
