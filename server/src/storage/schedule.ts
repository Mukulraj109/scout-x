/**
 * Shared scheduling utilities using Agenda (MongoDB-based).
 * Replaces the previous BullMQ + Redis implementation.
 */
import { v4 as uuid } from 'uuid';
import logger from '../logger';
import { scheduleRecurringTrigger, cancelScheduledTrigger } from '../queue/scraperQueue';

export async function scheduleWorkflow(
  id: string,
  userId: string,
  cronExpression: string,
  timezone: string
): Promise<void> {
  try {
    const scheduleJobId = `automation-schedule:${id}`;
    logger.log('info', `Scheduling workflow ${id} with cron expression ${cronExpression} in timezone ${timezone}`);
    await scheduleRecurringTrigger(id, userId, cronExpression, timezone, scheduleJobId);
    logger.log('info', `Scheduled workflow job for robot ${id}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log('error', `Failed to schedule workflow: ${errorMessage}`);
    throw error;
  }
}

export async function cancelScheduledWorkflow(robotId: string): Promise<boolean> {
  try {
    await cancelScheduledTrigger(robotId);
    logger.log('info', `Cancelled scheduled workflow for robot ${robotId}`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log('error', `Failed to cancel scheduled workflow: ${errorMessage}`);
    throw error;
  }
}
