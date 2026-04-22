import { MongoClient } from 'mongodb';
import { config as loadEnv } from 'dotenv';
loadEnv();

const TARGET_AUTOMATION_ID = process.argv[2];
if (!TARGET_AUTOMATION_ID) {
  console.error('Usage: node scripts/remove-schedule.mjs <automationId>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI missing'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE || 'firststep_db');

const jobs = db.collection('agendaJobs');
const robots = db.collection('maxun_robots');

const jobDel = await jobs.deleteMany({
  name: 'schedule-triggers',
  'data.automationId': TARGET_AUTOMATION_ID,
});
console.log(`Deleted ${jobDel.deletedCount} agendaJobs schedule-triggers doc(s) for ${TARGET_AUTOMATION_ID}`);

const robotUpdate = await robots.updateOne(
  { 'recording_meta.id': TARGET_AUTOMATION_ID },
  {
    $set: {
      'schedule.enabled': false,
      'schedule.cron': null,
      'schedule.nextRunAt': null,
      'schedule.updatedAt': new Date().toISOString(),
      'recording_meta.saasConfig.schedule.enabled': false,
      'recording_meta.saasConfig.schedule.cron': null,
      'recording_meta.saasConfig.schedule.nextRunAt': null,
    },
  }
);
console.log(`Robot doc updated: matched=${robotUpdate.matchedCount} modified=${robotUpdate.modifiedCount}`);

const remaining = await jobs.find({ name: 'schedule-triggers' }).toArray();
console.log(`\n=== ${remaining.length} schedule-triggers remaining ===`);
for (const j of remaining) {
  console.log({
    automationId: j.data?.automationId,
    repeatInterval: j.repeatInterval,
    repeatTimezone: j.repeatTimezone,
    nextRunAt: j.nextRunAt,
  });
}

await client.close();
