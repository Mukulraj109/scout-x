const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj_db_user:Mukulraj%40123@firststepauth.idrddbx.mongodb.net/firststep_db?retryWrites=true&w=majority&appName=firststepauth';

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // Check what fields contain schedule data
  const sample = await db.collection('robots').findOne({});
  if (sample) {
    console.log('Sample robot keys:', Object.keys(sample));
    console.log('schedule:', JSON.stringify(sample.schedule, null, 2));
    console.log('recording_meta.schedule:', JSON.stringify(sample.recording_meta?.schedule, null, 2));
  }

  // Try different paths
  const r1 = await db.collection('robots').countDocuments({ 'schedule.enabled': true });
  console.log('schedule.enabled:', r1);

  const r2 = await db.collection('robots').countDocuments({ 'recording_meta.schedule.enabled': true });
  console.log('recording_meta.schedule.enabled:', r2);

  const r3 = await db.collection('robots').countDocuments({ 'schedule.enabled': { $in: [true, false] } });
  console.log('schedule.enabled any:', r3);

  const r4 = await db.collection('robots').countDocuments({});
  console.log('total robots:', r4);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
