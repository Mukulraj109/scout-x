import { MongoClient } from 'mongodb';
import { config as loadEnv } from 'dotenv';
loadEnv();

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const jobs = client
  .db(process.env.MONGODB_DATABASE || 'firststep_db')
  .collection('agendaJobs');

const delSched = await jobs.deleteMany({ name: 'schedule-triggers' });
console.log(`Deleted ${delSched.deletedCount} schedule-triggers`);

const unlockRes = await jobs.updateMany(
  {
    name: 'scraper-jobs',
    lockedAt: { $ne: null },
    $or: [
      { lastFinishedAt: null },
      { $expr: { $lt: ['$lastFinishedAt', '$lockedAt'] } },
    ],
  },
  { $set: { lockedAt: null } }
);
console.log(`Unlocked ${unlockRes.modifiedCount} stale scraper-jobs locks`);

await client.close();
