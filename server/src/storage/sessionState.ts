import { mkdir, access } from 'fs/promises';
import path from 'path';

const SESSION_DIR = path.resolve(process.cwd(), '.runtime', 'session-state');

const ensureSessionDir = async () => {
  await mkdir(SESSION_DIR, { recursive: true });
};

export const getSessionStatePath = async (userId: string, automationId: string): Promise<string> => {
  await ensureSessionDir();
  return path.join(SESSION_DIR, `${userId}-${automationId}.json`);
};

export const sessionStateExists = async (userId: string, automationId: string): Promise<boolean> => {
  try {
    const filePath = await getSessionStatePath(userId, automationId);
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};
