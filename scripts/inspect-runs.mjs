import { MongoClient } from 'mongodb';
import { config as loadEnv } from 'dotenv';
loadEnv();

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE || 'firststep_db');

const robots = db.collection('maxun_robots');
const runs = db.collection('maxun_runs');

const robotList = await robots.find({}, {
  projection: {
    'recording_meta.id': 1,
    'recording_meta.name': 1,
    userId: 1,
    'schedule.lastRunAt': 1,
    'schedule.nextRunAt': 1,
    'schedule.enabled': 1,
    'schedule.cron': 1,
    'schedule.timezone': 1,
  },
}).toArray();

console.log('=== Robots ===');
for (const r of robotList) {
  console.log({
    id: r.recording_meta?.id,
    name: r.recording_meta?.name,
    lastRunAt: r.schedule?.lastRunAt,
    nextRunAt: r.schedule?.nextRunAt,
    cron: r.schedule?.cron,
    tz: r.schedule?.timezone,
  });
}

console.log('\n=== 10 most recent runs ===');
const recent = await runs
  .find({}, {
    projection: { runId: 1, robotId: 1, robotMetaId: 1, status: 1, startedAt: 1, finishedAt: 1, rowCount: 1, runByUserId: 1, userId: 1 },
  })
  .sort({ startedAt: -1 })
  .limit(10)
  .toArray();
for (const r of recent) {
  console.log({
    runId: r.runId,
    robotMetaId: r.robotMetaId,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    rowCount: r.rowCount,
  });
}

await client.close();
