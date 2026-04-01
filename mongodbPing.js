/**
 * MongoDB Atlas Connectivity Checker
 *
 * This script tests if you can connect to MongoDB Atlas using the MONGODB_URI
 * environment variable or .env file. It's a simple way to verify your connection
 * string and network access before deploying your application.
 *
 * What this does:
 * 1. Loads MongoDB connection string from environment or .env file
 * 2. Attempts to connect to MongoDB Atlas
 * 3. Sends a "ping" command to verify the database is responsive
 * 4. Reports success or failure with helpful troubleshooting tips
 *
 * Why this works:
 * - MongoDB Atlas requires SSL/TLS connections (enabled automatically in the driver)
 * - The "ping" command is a lightweight way to test connectivity without data operations
 * - We use the official MongoDB Node.js driver which is production-ready
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

/**
 * Parse .env file manually to handle URIs with special characters like &
 * This is more reliable than the dotenv package for complex URIs
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    // Remove surrounding quotes if present (handles "value" or 'value')
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  });

  return env;
}

// Load environment: check .env file in current directory
const envPath = path.join(process.cwd(), '.env');
const envVars = loadEnvFile(envPath);

// Get URI from env (process.env takes precedence, then .env file)
// Support both MONGODB_URI and MONGO_URI for flexibility
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || envVars.MONGODB_URI || envVars.MONGO_URI;

/**
 * Main function to test the MongoDB connection
 */
async function testConnection() {
  console.log('='.repeat(60));
  console.log('MongoDB Atlas Connectivity Test');
  console.log('='.repeat(60));

  // STEP 1: Validate connection string exists
  if (!uri) {
    console.error('\n❌ ERROR: MONGO_URI not found');
    console.error('\n📝 How to fix:');
    console.error('   1. Create a .env file in this directory with:');
    console.error('      MONGO_URI=your_mongodb_atlas_connection_string');
    console.error('   2. Or set the environment variable:');
    console.error('      Windows: set MONGO_URI=your_string');
    console.error('      Mac/Linux: export MONGO_URI=your_string');
    console.error('\n🔗 Get your connection string from Atlas:');
    console.error('   - Go to cloud.mongodb.com');
    console.error('   - Click "Connect" on your cluster');
    console.error('   - Choose "Drivers" → Copy the connection string');
    console.log('='.repeat(60));
    process.exit(1);
  }

  console.log(`\n📡 Connection string loaded (${uri.length} characters)`);
  console.log(`   URI: ${uri.substring(0, 60)}${uri.length > 60 ? '...' : ''}`);

  // Create MongoDB client
  // Modern MongoDB driver (v6+) doesn't need useNewUrlParser/useUnifiedTopology options
  const client = new MongoClient(uri);

  // STEP 2: Connect to MongoDB Atlas
  console.log('\n🔗 Step 1/2: Connecting to MongoDB Atlas...');

  try {
    await client.connect();
    console.log('   ✅ Network connection established successfully');
  } catch (error) {
    console.error('   ❌ Connection failed');
    console.error('\n🔧 TROUBLESHOOTING:');

    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED') || error.message.includes('querySrv')) {
      console.error('   • Network/DNS issue: Cannot reach the Atlas cluster');
      console.error('   • Check your internet connection');
      console.error('   • Verify the cluster name in your URI is correct');
      console.error('   • Ensure your cluster is running (not paused) in Atlas');
      console.error('   • Try using the standard (non-SRV) connection string');
    } else if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('   • Authentication failed: username or password is incorrect');
      console.error('   • Check Atlas Database Access to verify the user exists');
      console.error('   • Try resetting the user password in Atlas');
      console.error('   • Ensure authSource is set correctly (usually "admin")');
    } else if (error.message.includes('IP not whitelisted') || error.message.includes('authorized')) {
      console.error('   • Your IP address is not allowed in Atlas Network Access');
      console.error('   • Go to Atlas → Network Access → Add your current IP');
      console.error('   • Or temporarily allow 0.0.0.0/0 for testing');
    } else {
      console.error('   • Unexpected error:', error.message);
    }

    console.log('='.repeat(60));
    process.exit(1);
  }

  // STEP 3: Ping the database to verify it's responsive
  console.log('\n🏓 Step 2/2: Pinging the database...');

  try {
    // Ping the admin database - all MongoDB users have access to it
    await client.db('admin').command({ ping: 1 });
    console.log('   ✅ Ping successful! Database is responsive.');

    // Show some connection details
    const dbName = uri.split('/').pop()?.split('?')[0] || 'unknown';
    console.log('\n🎉 SUCCESS! Your MongoDB Atlas connection is working.');
    console.log('\n📊 Connection Details:');
    console.log(`   • Database: ${dbName}`);
    console.log(`   • Connected at: ${new Date().toISOString()}`);
    console.log(`   • Client: MongoDB Node.js driver v${require('mongodb/package.json').version}`);

    console.log('\n💡 Next Steps:');
    console.log('   1. Use this same MONGODB_URI in your Render environment variables');
    console.log('   2. Your app should connect successfully on deployment');
    console.log('   3. Monitor Atlas logs for connection activity');

  } catch (error) {
    console.error('   ❌ Ping failed - connected to network but database rejected the command');
    console.error('\n🔧 TROUBLESHOOTING:');
    console.error('   • Verify your user has read access to the admin database');
    console.error('   • Check if the database name in the URI is correct');
    console.error('   • Error details:', error.message);
  } finally {
    // STEP 4: Always close the connection to free resources
    console.log('\n📦 Closing connection...');
    try {
      await client.close();
      console.log('   ✅ Connection closed cleanly');
    } catch (closeError) {
      console.error('   ⚠️  Warning: Error while closing:', closeError.message);
    }

    console.log('='.repeat(60));
  }
}

// Run the test and handle any uncaught errors
testConnection().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
