import { MongoClient } from 'mongodb';
import { config as loadEnv } from 'dotenv';
loadEnv();

const runId = process.argv[2];
if (!runId) {
  console.error('Usage: node scripts/inspect-run.mjs <runId>');
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE || 'firststep_db');

const run = await db.collection('maxun_runs').findOne({ runId });
if (!run) {
  console.log(`Run ${runId} not found in maxun_runs`);
} else {
  console.log({
    runId: run.runId,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    retryCount: run.retryCount,
    errorMessage: run.errorMessage?.slice(0, 200),
  });
  console.log('\n--- tail of run.log ---');
  console.log(String(run.log || '').split('\n').slice(-15).join('\n'));
}

const ajob = await db.collection('agendaJobs').findOne({ name: 'scraper-jobs', 'data.runId': runId });
console.log('\n--- Agenda scraper-jobs doc ---');
if (!ajob) {
  console.log('(none)');
} else {
  console.log({
    _id: ajob._id?.toString(),
    lockedAt: ajob.lockedAt,
    lastRunAt: ajob.lastRunAt,
    lastFinishedAt: ajob.lastFinishedAt,
    failedAt: ajob.failedAt,
    failCount: ajob.failCount,
    _attemptsMade: ajob.data?._attemptsMade,
  });
}

await client.close();
