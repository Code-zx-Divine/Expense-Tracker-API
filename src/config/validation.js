/**
 * Environment Variable Validation
 *
 * Checks that all required environment variables are set at startup.
 * This fails fast if configuration is missing, rather than cryptic errors later.
 */

const requiredEnvVars = [
  'MONGO_URI',           // MongoDB connection string
  'ADMIN_SECRET'         // Admin routes authentication
];

const optionalEnvVarsWithDefaults = [
  { name: 'NODE_ENV', default: 'development' },
  { name: 'PORT', default: '3000' },
  { name: 'CORS_ORIGIN', default: '*' },
  { name: 'RATE_LIMIT_WINDOW_MS', default: '900000' },
  { name: 'RATE_LIMIT_MAX_REQUESTS', default: '100' },
  { name: 'REQUEST_TIMEOUT', default: '30000' },
  { name: 'LOG_LEVEL', default: 'info' }
];

/**
 * Validate that all required environment variables are set
 * @throws {Error} If any required variable is missing
 */
function validateEnv() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    console.error('❌ Configuration Error:', errorMsg);
    console.error('📝 Please set these in your .env file or Render environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}=<your-value>`);
    });
    throw new Error(errorMsg);
  }

  // Set defaults for optional variables if not provided
  optionalEnvVarsWithDefaults.forEach(({ name, default: defaultValue }) => {
    if (!process.env[name]) {
      process.env[name] = defaultValue;
      console.log(`⚙️  Using default for ${name}: ${defaultValue}`);
    }
  });

  console.log('✅ All required environment variables are set');
}

module.exports = { validateEnv };
