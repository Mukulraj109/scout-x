import { MongoClient } from 'mongodb';
import { config as loadEnv } from 'dotenv';
loadEnv();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE || 'firststep_db');
const robots = db.collection('maxun_robots');

const all = await robots.find({}, {
  projection: {
    'recording_meta.id': 1,
    'recording_meta.name': 1,
    userId: 1,
    schedule: 1,
    'recording_meta.saasConfig.schedule': 1,
  },
}).toArray();

console.log(`=== ${all.length} robots ===`);
for (const r of all) {
  console.log({
    id: r.recording_meta?.id,
    name: r.recording_meta?.name,
    userId: r.userId,
    schedule: r.schedule,
    saasSchedule: r.recording_meta?.saasConfig?.schedule,
  });
}

await client.close();
