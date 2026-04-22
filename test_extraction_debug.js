/**
 * Extraction Debug Script
 *
 * This script traces through the extraction flow to identify where
 * it breaks after the PostgreSQL -> MongoDB migration.
 *
 * Run: node test_extraction_debug.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mukulraj_db_user:Mukulraj%40123@firststepauth.idrddbx.mongodb.net/firststep_db?retryWrites=true&w=majority&appName=firststepauth';

async function runTests() {
  console.log('=== Maxun Extraction Debug Test ===\n');

  // Test 1: MongoDB Connection
  console.log('1. Testing MongoDB connection...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('   [PASS] MongoDB connected successfully');
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Name: ${mongoose.connection.name}`);
  } catch (error) {
    console.error(`   [FAIL] MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  // Test 2: Robot Model - Query by recording_meta.id
  console.log('\n2. Testing Robot model query by recording_meta.id...');
  try {
    const RobotSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.Mixed, required: true },
      recording_meta: { type: mongoose.Schema.Types.Mixed, required: true },
      recording: { type: mongoose.Schema.Types.Mixed, required: true },
    }, { timestamps: false, collection: 'maxun_robots' });

    const Robot = mongoose.models.RobotDebug || mongoose.model('RobotDebug', RobotSchema);

    // Check if any robots exist
    const robotCount = await Robot.countDocuments();
    console.log(`   Total robots in DB: ${robotCount}`);

    if (robotCount > 0) {
      const sampleRobot = await Robot.findOne().lean();
      console.log(`   Sample robot id field: ${sampleRobot.id}`);
      console.log(`   Sample robot _id: ${sampleRobot._id}`);
      console.log(`   Sample robot recording_meta.id: ${sampleRobot.recording_meta?.id}`);
      console.log(`   Sample robot recording_meta.name: ${sampleRobot.recording_meta?.name}`);
      console.log(`   Sample robot userId: ${sampleRobot.userId} (type: ${typeof sampleRobot.userId})`);

      // Test query by recording_meta.id
      const found = await Robot.findOne({ 'recording_meta.id': sampleRobot.recording_meta.id }).lean();
      if (found) {
        console.log('   [PASS] Query by recording_meta.id works');
      } else {
        console.error('   [FAIL] Query by recording_meta.id returned null');
      }

      // Check if saasConfig exists
      if (sampleRobot.recording_meta?.saasConfig) {
        console.log('   [INFO] saasConfig found in recording_meta');
        console.log(`   saasConfig keys: ${Object.keys(sampleRobot.recording_meta.saasConfig).join(', ')}`);
        if (sampleRobot.recording_meta.saasConfig.listExtraction) {
          console.log('   [INFO] listExtraction config:');
          console.log(`     itemSelector: ${sampleRobot.recording_meta.saasConfig.listExtraction.itemSelector || '(empty)'}`);
          console.log(`     fields count: ${Object.keys(sampleRobot.recording_meta.saasConfig.listExtraction.fields || {}).length}`);
        }
      } else {
        console.log('   [WARN] No saasConfig found in sample robot');
      }

      // Check recording workflow
      if (sampleRobot.recording?.workflow) {
        console.log(`   [INFO] recording.workflow length: ${sampleRobot.recording.workflow.length}`);
      }
    } else {
      console.log('   [INFO] No robots in DB yet - need to create one via chrome extension');
    }
  } catch (error) {
    console.error(`   [FAIL] Robot model test failed: ${error.message}`);
  }

  // Test 3: ExtractedData Model
  console.log('\n3. Testing ExtractedData model...');
  try {
    const ExtractedDataSchema = new mongoose.Schema({
      runId: { type: mongoose.Schema.Types.Mixed, required: true },
      robotMetaId: { type: String, required: true },
      source: { type: String, required: true, default: 'scrapeList' },
      data: { type: mongoose.Schema.Types.Mixed, required: true },
    }, { timestamps: { createdAt: true, updatedAt: false }, collection: 'maxun_extracteddata' });

    const ExtractedData = mongoose.models.ExtractedDataDebug || mongoose.model('ExtractedDataDebug', ExtractedDataSchema);

    const dataCount = await ExtractedData.countDocuments();
    console.log(`   Total ExtractedData records: ${dataCount}`);

    if (dataCount > 0) {
      const sampleData = await ExtractedData.findOne().lean();
      console.log(`   Sample runId: ${sampleData.runId} (type: ${typeof sampleData.runId})`);
      console.log(`   Sample robotMetaId: ${sampleData.robotMetaId}`);
      console.log(`   Sample data keys: ${Object.keys(sampleData.data || {}).join(', ')}`);

      // Test query by runId (string)
      const foundByString = await ExtractedData.findOne({ runId: String(sampleData.runId) }).lean();
      if (foundByString) {
        console.log('   [PASS] Query by string runId works');
      } else {
        console.error('   [FAIL] Query by string runId returned null');
      }
    }
  } catch (error) {
    console.error(`   [FAIL] ExtractedData model test failed: ${error.message}`);
  }

  // Test 4: Run Model
  console.log('\n4. Testing Run model...');
  try {
    const RunSchema = new mongoose.Schema({
      status: { type: String, required: true },
      name: { type: String, required: true },
      robotId: { type: String, default: null },
      robotMetaId: { type: String, required: true },
      startedAt: { type: String, default: null },
      finishedAt: { type: String, default: null },
      runId: { type: String, required: true },
      runByUserId: { type: mongoose.Schema.Types.Mixed, default: null },
      serializableOutput: { type: mongoose.Schema.Types.Mixed, default: null },
    }, { timestamps: false, collection: 'maxun_runs' });

    const Run = mongoose.models.RunDebug || mongoose.model('RunDebug', RunSchema);

    const runCount = await Run.countDocuments();
    console.log(`   Total runs in DB: ${runCount}`);

    if (runCount > 0) {
      const sampleRun = await Run.findOne().lean();
      console.log(`   Sample runId: ${sampleRun.runId}`);
      console.log(`   Sample robotId: ${sampleRun.robotId} (type: ${typeof sampleRun.robotId})`);
      console.log(`   Sample robotMetaId: ${sampleRun.robotMetaId}`);
      console.log(`   Sample runByUserId: ${sampleRun.runByUserId} (type: ${typeof sampleRun.runByUserId})`);

      // Check if robotMetaId matches any robot's recording_meta.id
      if (sampleRun.robotMetaId) {
        const matchingRobot = await mongoose.connection.db
          .collection('maxun_robots')
          .findOne({ 'recording_meta.id': sampleRun.robotMetaId });
        if (matchingRobot) {
          console.log('   [PASS] robotMetaId matches a robot');
        } else {
          console.error('   [FAIL] robotMetaId does not match any robot');
        }
      }
    }
  } catch (error) {
    console.error(`   [FAIL] Run model test failed: ${error.message}`);
  }

  // Test 5: Simulate getAutomationConfig
  console.log('\n5. Testing getAutomationConfig logic...');
  try {
    const robots = await mongoose.connection.db.collection('maxun_robots').find({}).limit(3).toArray();

    for (const robot of robots) {
      const config = robot.recording_meta?.saasConfig;
      console.log(`   Robot: ${robot.recording_meta?.name}`);
      console.log(`   Has saasConfig: ${!!config}`);
      if (config) {
        const hasListExtraction = !!(config.listExtraction?.itemSelector && config.listExtraction?.fields);
        console.log(`   Has valid listExtraction: ${hasListExtraction}`);
        if (config.listExtraction?.itemSelector) {
          console.log(`   itemSelector: "${config.listExtraction.itemSelector}"`);
        }
        if (config.listExtraction?.fields) {
          console.log(`   fields: ${JSON.stringify(config.listExtraction.fields)}`);
        }
      } else {
        console.log(`   [WARN] No saasConfig - web app recording flow`);
        if (robot.recording?.workflow?.length > 0) {
          console.log(`   workflow steps: ${robot.recording.workflow.length}`);
        }
      }
      console.log('');
    }
  } catch (error) {
    console.error(`   [FAIL] getAutomationConfig test failed: ${error.message}`);
  }

  // Test 6: Check session store
  console.log('6. Testing MongoDB session store (connect-mongo)...');
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log(`   Collections: ${collectionNames.join(', ')}`);

    if (collectionNames.includes('sessions')) {
      const sessionCount = await mongoose.connection.db.collection('sessions').countDocuments();
      console.log(`   [INFO] Sessions collection has ${sessionCount} documents`);
    } else {
      console.log('   [WARN] No sessions collection found - sessions may not persist');
    }
  } catch (error) {
    console.error(`   [FAIL] Session store test failed: ${error.message}`);
  }

  console.log('\n=== Test Complete ===');
  await mongoose.disconnect();
}

runTests().catch(console.error);
