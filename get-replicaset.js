require('dotenv').config();
const mongoose = require('mongoose');

const uri = 'mongodb://prashantshinde2754_db_user:Code0000_zx@ac-ds3lggx-shard-00-00.veilklf.mongodb.net:27017/expenseDB?ssl=true&authSource=admin';

mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
.then(async () => {
  const admin = mongoose.connection.db.admin();
  const isMaster = await admin.command({ isMaster: 1 });
  console.log('✅ Connected!');
  console.log('Replica Set Name:', isMaster.setName);
  console.log('Primary:', isMaster.primary);
  console.log('Hosts:', isMaster.hosts);
  await mongoose.disconnect();
})
.catch(err => {
  console.error('❌ Error:', err.message);
});
