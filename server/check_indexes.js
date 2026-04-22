const mongoose = require('mongoose');
const uri = "mongodb+srv://mukulraj_db_user:Mukulraj%40123@firststepauth.idrddbx.mongodb.net/firststep_db?retryWrites=true&w=majority&appName=firststepauth";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const indexes = await db.collection('users').indexes();
  console.log('Indexes on users collection:', indexes);
  process.exit(0);
}

run().catch(console.error);
