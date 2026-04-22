/**
 * Loads .env from repo root and prints document counts for Maxun-related collections.
 * Usage: node scripts/mongo-counts.mjs
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

const targets = [
  'maxun_robots',
  'maxun_runs',
  'maxun_extracteddata',
  'agendaJobs',
  'sessions',
  'maxun_users',
];

await mongoose.connect(uri);
const db = mongoose.connection.db;
const all = await db.listCollections().toArray();
const names = new Set(all.map((c) => c.name));

const out = { database: db.databaseName, MONGODB_URI_set: true };
for (const coll of targets) {
  if (!names.has(coll)) {
    out[coll] = '(collection missing)';
    continue;
  }
  out[coll] = await db.collection(coll).countDocuments();
}

console.log(JSON.stringify(out, null, 2));
await mongoose.disconnect();
