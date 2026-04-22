/**
 * Optional Firebase Storage (Admin SDK) for run screenshots and binary artifacts.
 * When credentials are absent or init fails, all functions no-op or return null — same idea as MinIO being down.
 */
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import logger from '../logger';

/** Default signed URL lifetime for stored screenshots (7 days). */
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let firebaseApp: admin.app.App | undefined;
let initAttempted = false;
let initFailed = false;

function readProjectIdFromCredentialsFile(): string | null {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!p || !fs.existsSync(p)) {
    return null;
  }
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { project_id?: string };
    return j.project_id || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the GCS bucket name used by Firebase Storage (typically `projectId.appspot.com`).
 */
export function resolveFirebaseBucketName(): string | null {
  if (process.env.FIREBASE_STORAGE_BUCKET?.trim()) {
    return process.env.FIREBASE_STORAGE_BUCKET.trim();
  }
  const pid = process.env.FIREBASE_PROJECT_ID?.trim() || readProjectIdFromCredentialsFile();
  return pid ? `${pid}.appspot.com` : null;
}

/**
 * True when Firebase object storage should be used (credentials present and not explicitly disabled).
 */
export function isFirebaseObjectStorageEnabled(): boolean {
  if (process.env.ENABLE_FIREBASE_STORAGE === 'false') {
    return false;
  }
  if (initFailed) {
    return false;
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return false;
  }
  if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return false;
  }
  return true;
}

function getFirebaseApp(): admin.app.App | null {
  if (process.env.ENABLE_FIREBASE_STORAGE === 'false') {
    return null;
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return null;
  }
  if (firebaseApp) {
    return firebaseApp;
  }
  if (admin.apps.length > 0) {
    firebaseApp = admin.app();
    return firebaseApp;
  }
  if (initAttempted && initFailed) {
    return null;
  }
  initAttempted = true;
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    firebaseApp = admin.app();
    logger.log('info', 'Firebase Admin initialized (object storage available).');
    return firebaseApp;
  } catch (err: any) {
    initFailed = true;
    logger.log('warn', `Firebase Admin init failed — object storage disabled: ${err?.message || err}`);
    return null;
  }
}

/**
 * Returns the Storage bucket, or null if Firebase is not configured / failed to init.
 */
export function getObjectStorageBucket(): ReturnType<admin.storage.Storage['bucket']> | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  const name = resolveFirebaseBucketName();
  if (!name) {
    logger.log(
      'warn',
      'Firebase Storage: set FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID / valid service account JSON with project_id'
    );
    return null;
  }
  return admin.storage().bucket(name);
}

let loggedStorageOff = false;
export function logObjectStorageSkippedOnce(): void {
  if (loggedStorageOff) {
    return;
  }
  loggedStorageOff = true;
  logger.log(
    'info',
    'Object storage not configured (set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service account JSON to enable Firebase Storage for screenshots).'
  );
}

/**
 * Upload buffer and return a signed HTTPS URL, or null if storage is unavailable.
 */
export async function uploadBufferSignedUrl(
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const bucket = getObjectStorageBucket();
  if (!bucket) {
    return null;
  }
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'private, max-age=300',
    },
  });
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });
  return url;
}

/**
 * Delete all objects under `prefixRoot/runId/` (e.g. maxun-run-screenshots/<runId>/).
 */
export async function deleteObjectsForRunPrefix(pathPrefixRoot: string, runId: string): Promise<void> {
  const bucket = getObjectStorageBucket();
  if (!bucket) {
    return;
  }
  const prefix = `${pathPrefixRoot.replace(/\/$/, '')}/${runId}/`;
  try {
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(
      files.map((f) =>
        f.delete().catch((e: unknown) => {
          logger.log('warn', `Failed to delete storage object ${f.name}: ${e}`);
        })
      )
    );
  } catch (e: any) {
    logger.log('warn', `Firebase Storage cleanup prefix ${prefix}: ${e?.message || e}`);
  }
}

export async function removeFirebaseObjectsForRunIds(
  runIds: string[],
  pathPrefixRoot = 'maxun-run-screenshots'
): Promise<void> {
  if (runIds.length === 0) {
    return;
  }
  if (!getObjectStorageBucket()) {
    return;
  }
  for (const runId of runIds) {
    await deleteObjectsForRunPrefix(pathPrefixRoot, runId);
  }
}

/**
 * Download object bytes (full object path within bucket).
 */
export async function downloadBuffer(objectPath: string): Promise<Buffer | null> {
  const bucket = getObjectStorageBucket();
  if (!bucket) {
    return null;
  }
  const [buf] = await bucket.file(objectPath).download();
  return buf;
}
