require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
console.log('URI:', uri.substring(0, 60) + '...');

mongoose.connect(uri, { 
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000 
})
.then(async () => {
  console.log('✅ MongoDB Connected!');
  console.log('Host:', mongoose.connection.host);
  await mongoose.connection.close();
  console.log('Closed');
})
.catch(err => {
  console.error('❌ Error:', err.message);
  console.error('Code:', err.code);
  process.exit(1);
});
