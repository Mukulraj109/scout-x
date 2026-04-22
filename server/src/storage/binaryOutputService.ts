import Run, { IRun } from '../models/Run';
import {
  downloadBuffer,
  isFirebaseObjectStorageEnabled,
  logObjectStorageSkippedOnce,
  uploadBufferSignedUrl,
} from './firebaseStorage';

/**
 * Persists screenshot / binary artifacts to optional Firebase Storage and stores signed URLs on the run.
 * Replaces the former MinIO-backed implementation.
 */
export class BinaryOutputService {
  private pathPrefix: string;

  constructor(pathPrefix: string) {
    this.pathPrefix = pathPrefix.replace(/\/$/, '');
  }

  /**
   * Uploads binary data to Firebase Storage (when configured) and stores signed URLs on the run.
   */
  async uploadAndStoreBinaryOutput(run: IRun, binaryOutput: Record<string, any>): Promise<Record<string, string>> {
    const uploadedBinaryOutput: Record<string, string> = {};
    const plainRun = run.toJSON();

    if (!isFirebaseObjectStorageEnabled()) {
      logObjectStorageSkippedOnce();
    }

    for (const key of Object.keys(binaryOutput)) {
      let binaryData = binaryOutput[key];

      if (!plainRun.runId) {
        console.error('IRun ID is undefined. Cannot upload binary data.');
        continue;
      }

      console.log(`Processing binary output key: ${key}`);

      let bufferData: Buffer | null = null;

      if (binaryData && typeof binaryData === 'object' && binaryData.data) {
        const dataString = binaryData.data;

        if (typeof dataString === 'string') {
          try {
            if (dataString.startsWith('data:')) {
              const base64Match = dataString.match(/^data:([^;]+);base64,(.+)$/);
              if (base64Match) {
                bufferData = Buffer.from(base64Match[2], 'base64');
                console.log(`Converted data URI to Buffer for key: ${key}`);
              }
            } else {
              try {
                const parsed = JSON.parse(dataString);
                if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) {
                  bufferData = Buffer.from(parsed.data);
                  console.log(`Converted JSON Buffer format for key: ${key}`);
                } else {
                  bufferData = Buffer.from(dataString, 'base64');
                  console.log(`Converted raw base64 to Buffer for key: ${key}`);
                }
              } catch {
                bufferData = Buffer.from(dataString, 'base64');
                console.log(`Converted raw base64 to Buffer for key: ${key}`);
              }
            }
          } catch (error) {
            console.error(`Failed to parse binary data for key ${key}:`, error);
            continue;
          }
        }
      }

      if (!bufferData || !Buffer.isBuffer(bufferData)) {
        console.error(`Invalid or empty buffer for key ${key}`);
        continue;
      }

      try {
        const objectKey = `${plainRun.runId}/${encodeURIComponent(key.trim().replace(/\s+/g, '_'))}`;
        const objectPath = `${this.pathPrefix}/${objectKey}`;
        const contentType = binaryData.mimeType || 'image/png';

        console.log(`Uploading to object path ${objectPath}`);

        const signedUrl = await uploadBufferSignedUrl(objectPath, bufferData, contentType);

        if (!signedUrl) {
          console.warn(`Skipping remote upload for key ${key} (object storage unavailable)`);
          continue;
        }

        uploadedBinaryOutput[key] = signedUrl;
        console.log(`Uploaded and stored: ${signedUrl.substring(0, 80)}…`);
      } catch (error) {
        console.error(`Error uploading key ${key} to Firebase Storage:`, error);
      }
    }

    console.log('Uploaded Binary Output:', uploadedBinaryOutput);

    try {
      run.binaryOutput = uploadedBinaryOutput;
      await run.save();
      console.log('IRun successfully updated with binary output');
    } catch (updateError) {
      console.error('Error updating run with binary output:', updateError);
    }

    return uploadedBinaryOutput;
  }

  /** Lower-level upload used by some workers; requires Firebase to be configured. */
  async uploadBinaryOutputToMinioBucket(run: IRun, key: string, data: Buffer): Promise<void> {
    const plainRun = run.toJSON();
    if (!plainRun.runId) {
      throw new Error('runId is required');
    }
    if (!isFirebaseObjectStorageEnabled()) {
      logObjectStorageSkippedOnce();
      throw new Error('Firebase object storage is not configured');
    }
    const objectPath = `${this.pathPrefix}/${plainRun.runId}/${encodeURIComponent(key)}`;
    const url = await uploadBufferSignedUrl(objectPath, data, 'image/png');
    if (!url) {
      throw new Error('Upload failed (storage unavailable)');
    }
    const existing = (run.binaryOutput as Record<string, string>) || {};
    run.binaryOutput = { ...existing, [key]: url };
    console.log(`Successfully uploaded to Firebase Storage: ${objectPath}`);
  }

  public async getBinaryOutputFromMinioBucket(key: string): Promise<Buffer> {
    const objectPath = `${this.pathPrefix}/${key}`;
    const buf = await downloadBuffer(objectPath);
    if (!buf) {
      throw new Error('Firebase object storage is not configured or object not found');
    }
    return buf;
  }
}
