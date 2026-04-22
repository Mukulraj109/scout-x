import { MongoClient } from 'mongodb';
import { config as loadEnv } from 'dotenv';
loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI missing'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE || 'firststep_db');
const jobs = db.collection('agendaJobs');

const sched = await jobs.find({ name: 'schedule-triggers' }).sort({ nextRunAt: 1 }).toArray();
console.log(`=== ${sched.length} schedule-triggers ===`);
for (const j of sched) {
  console.log({
    automationId: j.data?.automationId,
    repeatInterval: j.repeatInterval,
    repeatTimezone: j.repeatTimezone,
    nextRunAt: j.nextRunAt,
    lastRunAt: j.lastRunAt,
    lastFinishedAt: j.lastFinishedAt,
    lockedAt: j.lockedAt,
    failReason: j.failReason,
    failCount: j.failCount,
  });
}

const recent = await jobs.find({ name: 'scraper-jobs' }).sort({ _id: -1 }).limit(3).toArray();
console.log(`\n=== 3 most recent scraper-jobs ===`);
for (const j of recent) {
  console.log({
    _id: j._id?.toString(),
    runId: j.data?.runId,
    nextRunAt: j.nextRunAt,
    lastRunAt: j.lastRunAt,
    lastFinishedAt: j.lastFinishedAt,
    lockedAt: j.lockedAt,
    failReason: j.failReason,
  });
}

console.log(`\nCurrent UTC: ${new Date().toISOString()}`);
await client.close();
