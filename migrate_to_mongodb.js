/**
 * Migration script: Postgres + Redis → MongoDB Atlas
 * Run with: node migrate_to_mongodb.js
 */
const { Client: PgClient } = require('pg');
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj_db_user:Mukulraj%40123@firststepauth.idrddbx.mongodb.net/firststep_db?retryWrites=true&w=majority&appName=firststepauth';

const PG = {
  host: '127.0.0.1',
  port: 6380,
  database: 'maxun',
  user: 'postgres',
  password: '', // no password on Docker Postgres
};

async function migrate() {
  console.log('=== Starting Postgres → MongoDB Atlas migration ===\n');

  // Connect to MongoDB
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  const mongo = mongoose.connection.db;
  console.log('MongoDB connected.\n');

  // Connect to Postgres
  console.log('Connecting to Postgres...');
  const pg = new PgClient(PG);
  await pg.connect();
  console.log('Postgres connected.\n');

  // ─── 1. Migrate Users ───────────────────────────────────────────────
  console.log('--- Migrating users ---');
  const pgUsers = await pg.query('SELECT * FROM "user"');
  const mongoUsers = mongo.collection('maxun_users');

  let usersMigrated = 0;
  for (const row of pgUsers.rows) {
    const doc = {
      email: row.email,
      password: row.password,
      api_key_name: row.api_key_name,
      api_key: row.api_key,
      api_key_created_at: row.api_key_created_at,
      proxy_url: row.proxy_url,
      proxy_username: row.proxy_username,
      proxy_password: row.proxy_password,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
    };
    try {
      await mongoUsers.updateOne(
        { email: row.email },
        { $set: doc },
        { upsert: true }
      );
      usersMigrated++;
    } catch (e) {
      console.error(`  Failed to migrate user ${row.email}: ${e.message}`);
    }
  }
  console.log(`Migrated ${usersMigrated}/${pgUsers.rows.length} users\n`);

  // ─── 2. Migrate Robots ─────────────────────────────────────────────
  console.log('--- Migrating robots ---');
  const pgRobots = await pg.query('SELECT * FROM robot');
  const mongoRobots = mongo.collection('maxun_robots');

  let robotsMigrated = 0;
  for (const row of pgRobots.rows) {
    const doc = {
      id: row.id, // keep the UUID id
      userId: row.userId,
      recording_meta: row.recording_meta,
      recording: row.recording,
      google_sheet_email: row.google_sheet_email,
      google_sheet_name: row.google_sheet_name,
      google_sheet_id: row.google_sheet_id,
      google_access_token: row.google_access_token,
      google_refresh_token: row.google_refresh_token,
      airtable_base_id: row.airtable_base_id,
      airtable_base_name: row.airtable_base_name,
      airtable_table_name: row.airtable_table_name,
      airtable_table_id: row.airtable_table_id,
      airtable_access_token: row.airtable_access_token,
      airtable_refresh_token: row.airtable_refresh_token,
      schedule: row.schedule,
      webhooks: row.webhooks,
    };
    try {
      await mongoRobots.updateOne(
        { id: row.id },
        { $set: doc },
        { upsert: true }
      );
      robotsMigrated++;
    } catch (e) {
      console.error(`  Failed to migrate robot ${row.id}: ${e.message}`);
    }
  }
  console.log(`Migrated ${robotsMigrated}/${pgRobots.rows.length} robots\n`);

  // ─── 3. Migrate Sessions ───────────────────────────────────────────
  console.log('--- Migrating sessions ---');
  const pgSessions = await pg.query('SELECT * FROM session');
  const mongoSessions = mongo.collection('sessions');

  let sessionsMigrated = 0;
  for (const row of pgSessions.rows) {
    const doc = {
      _id: row.sid,
      expires: row.expire,
      session: row.sess,
    };
    try {
      await mongoSessions.updateOne(
        { _id: row.sid },
        { $set: doc },
        { upsert: true }
      );
      sessionsMigrated++;
    } catch (e) {
      console.error(`  Failed to migrate session ${row.sid}: ${e.message}`);
    }
  }
  console.log(`Migrated ${sessionsMigrated}/${pgSessions.rows.length} sessions\n`);

  // ─── 4. Migrate ExtractedData ──────────────────────────────────────
  console.log('--- Migrating extracted_data ---');
  const pgExtracted = await pg.query('SELECT id, "runId", "robotMetaId", source, data, "createdAt" FROM extracted_data');
  const mongoExtracted = mongo.collection('maxun_extracteddata');

  let extractedMigrated = 0;
  for (const row of pgExtracted.rows) {
    const doc = {
      id: row.id,
      runId: row.runId,
      robotMetaId: row.robotMetaId,
      source: row.source,
      data: row.data,
      createdAt: row.createdAt,
    };
    try {
      await mongoExtracted.updateOne(
        { id: row.id },
        { $set: doc },
        { upsert: true }
      );
      extractedMigrated++;
    } catch (e) {
      console.error(`  Failed to migrate extracted_data ${row.id}: ${e.message}`);
    }
  }
  console.log(`Migrated ${extractedMigrated}/${pgExtracted.rows.length} extracted_data records\n`);

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('=== Migration Complete ===');
  console.log(`Users:       ${usersMigrated}/${pgUsers.rows.length}`);
  console.log(`Robots:      ${robotsMigrated}/${pgRobots.rows.length}`);
  console.log(`Sessions:    ${sessionsMigrated}/${pgSessions.rows.length}`);
  console.log(`Extracted:   ${extractedMigrated}/${pgExtracted.rows.length}`);

  // Verify
  console.log('\n--- Verifying MongoDB collections ---');
  console.log('maxun_users:', await mongoUsers.countDocuments());
  console.log('maxun_robots:', await mongoRobots.countDocuments());
  console.log('sessions:', await mongoSessions.countDocuments());
  console.log('maxun_extracteddata:', await mongoExtracted.countDocuments());

  await pg.end();
  await mongoose.disconnect();
  console.log('\nDone!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
