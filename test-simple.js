require('dotenv').config();
const mongoose = require('mongoose');

// Simple connection - single host, no replicaSet
const uri = 'mongodb://prashantshinde2754_db_user:Code0000_zx@ac-ds3lggx-shard-00-00.veilklf.mongodb.net:27017/expenseDB?ssl=true&authSource=admin';

console.log('Testing simple connection...');

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000,
  maxPoolSize: 1
})
.then(async () => {
  console.log('✅ Connected!');
  const db = mongoose.connection.db;
  const dbs = await db.admin().listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name).slice(0,5));
  await mongoose.disconnect();
})
.catch(err => {
  console.error('❌ Error:', err.message);
  console.error('Code:', err.code);
  if (err.message.includes('authentication')) {
    console.error('💡 Check username/password');
  }
  if (err.message.includes('SSL')) {
    console.error('💡 SSL handshake failed');
  }
});
