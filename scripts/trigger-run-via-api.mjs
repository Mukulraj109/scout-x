/**
 * POST /api/automations/:id/run using x-api-key from MongoDB (if set).
 * Usage: node scripts/trigger-run-via-api.mjs [automationNameSubstring]
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const nameFilter = process.argv[2] || 'ally';
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const user = await db.collection('maxun_users').findOne({
  api_key: { $exists: true, $nin: [null, ''] },
});
const robot = await db.collection('maxun_robots').findOne({
  'recording_meta.name': new RegExp(nameFilter, 'i'),
});

if (!robot) {
  console.log(`No robot matching name /${nameFilter}/i — create an automation or pass another substring.`);
  await mongoose.disconnect();
  process.exit(0);
}

const automationId = robot.recording_meta?.id;
if (!automationId) {
  console.log('Robot has no recording_meta.id');
  await mongoose.disconnect();
  process.exit(1);
}

if (!user?.api_key) {
  console.log(
    'No user with api_key in DB — add one in the app (API Key page) or click Run in the UI.\n' +
      `Embedded workers are on; automation id for manual run: ${automationId}`
  );
  await mongoose.disconnect();
  process.exit(0);
}

const res = await fetch(`http://127.0.0.1:8080/api/automations/${automationId}/run`, {
  method: 'POST',
  headers: {
    'x-api-key': user.api_key,
    'Content-Type': 'application/json',
  },
});

const text = await res.text();
console.log(`POST /api/automations/${automationId}/run → HTTP ${res.status}`);
console.log(text.slice(0, 800));

await mongoose.disconnect();
