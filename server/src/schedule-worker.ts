/**
 * Dev / optional entry: registers the same `schedule-triggers` processor as the API process
 * (`processScheduledRun` in automationScheduler). When loaded after
 * `rehydrateAutomationSchedules()`, `registerScheduleProcessor()` is a no-op (single process).
 */
import dotenv from 'dotenv';
import logger from './logger';
import { registerScheduleProcessor } from './services/automationScheduler';

dotenv.config();

registerScheduleProcessor()
  .then(() => {
    logger.log('info', 'Schedule worker module ready (schedule-triggers use automationScheduler)');
  })
  .catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log('error', `Failed to register schedule processor: ${errorMessage}`);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  logger.log('info', 'SIGTERM received, shutting down schedule worker...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.log('info', 'SIGINT received, shutting down schedule worker...');
  process.exit(0);
});
