const { MongoClient, ServerApiVersion } = require('mongodb');

// Your MongoDB Atlas connection string
const uri = "mongodb+srv://prashantshinde2754_db_user:Code0000_zx@apitest.93gflwg.mongodb.net/expense-tracker?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    console.log(`📡 URI: ${uri.substring(0, 50)}...`);

    // Connect the client to the server
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas!');

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log('✅ Ping successful! Database is responsive.');

    // Test database access
    const db = client.db('expense-tracker');
    const collections = await db.listCollections().toArray();
    console.log(`📊 Database 'expense-tracker' exists and has ${collections.length} collection(s)`);

    console.log('\n🎉 SUCCESS! Your MongoDB connection is working correctly.');
    console.log('💡 You can now use this URI in your Render MONGO_URI environment variable.');

  } catch (error) {
    console.error('\n❌ CONNECTION FAILED');
    console.error('Error:', error.message);
    console.error('\n🔧 TROUBLESHOOTING:');

    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('1. Check username/password in your connection string');
      console.error('2. Verify user exists in Atlas Database Access');
      console.error('3. Reset the user password if needed');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('1. Check your internet connection');
      console.error('2. Verify cluster name in URI is correct');
      console.error('3. Check Atlas cluster is not paused');
    } else if (error.message.includes('IP not whitelisted')) {
      console.error('1. Go to Atlas → Network Access → Add your IP address');
      console.error('2. Or allow 0.0.0.0/0 for testing');
    } else {
      console.error('See full error above for details');
    }
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log('\n📦 Connection closed.');
  }
}

run();
