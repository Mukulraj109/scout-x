import { unlink } from 'fs/promises';
import Robot from '../models/Robot';
import Run from '../models/Run';
import ExtractedData from '../models/ExtractedData';
import { cancelScheduledTrigger, getAgenda } from '../queue/scraperQueue';
import { getSessionStatePath } from '../storage/sessionState';
import { removeFirebaseObjectsForRunIds } from '../storage/firebaseStorage';
import logger from '../logger';

async function removeStoredObjectsForRunIds(runIds: string[]): Promise<void> {
  if (runIds.length === 0) return;
  try {
    await removeFirebaseObjectsForRunIds(runIds, 'maxun-run-screenshots');
  } catch (e: any) {
    logger.log('warn', `Object storage cleanup for deleted automation (partial or skipped): ${e?.message || e}`);
  }
}

/**
 * Permanently removes an automation and all related data: Agenda jobs (schedules, scraper,
 * execute-run, etc.), runs, extracted rows, Playwright session state file, and Firebase Storage
 * objects under each runId prefix in `maxun-run-screenshots` (when Firebase is configured).
 */
export async function deleteAutomationCascade(userId: string | number, automationId: string): Promise<void> {
  const robot: any = await Robot.findOne({
    userId,
    'recording_meta.id': automationId,
  });

  if (!robot) {
    const err: any = new Error('Automation not found');
    err.statusCode = 404;
    throw err;
  }

  const runs = await Run.find({ robotMetaId: automationId }).select('runId').lean();
  const runIds = runs.map((r: any) => r.runId).filter(Boolean) as string[];

  await cancelScheduledTrigger(automationId);

  const agenda = await getAgenda();
  const orClauses: Record<string, unknown>[] = [{ name: 'scraper-jobs', 'data.automationId': automationId }];
  if (runIds.length > 0) {
    orClauses.push(
      { name: 'scraper-jobs', 'data.runId': { $in: runIds } },
      { name: 'execute-run', 'data.runId': { $in: runIds } },
      { name: 'execute-run-user', 'data.runId': { $in: runIds } },
      { name: 'abort-run', 'data.runId': { $in: runIds } },
    );
  }
  const deletedJobs = await agenda.cancel({ $or: orClauses });
  logger.log('info', `Removed ${deletedJobs ?? 0} Agenda job(s) for automation ${automationId}`);

  await removeStoredObjectsForRunIds(runIds);

  try {
    const sessionPath = await getSessionStatePath(String(userId), automationId);
    await unlink(sessionPath);
  } catch {
    // no session file
  }

  await ExtractedData.deleteMany({ robotMetaId: automationId });
  const runDel = await Run.deleteMany({ robotMetaId: automationId });
  await Robot.deleteOne({ _id: robot._id });

  logger.log(
    'info',
    `Deleted automation ${automationId}: ${runDel.deletedCount ?? 0} run(s), extracted data, schedules, and queue jobs`
  );
}
