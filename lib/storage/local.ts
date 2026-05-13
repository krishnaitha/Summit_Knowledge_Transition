import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

function resolveSafeUploadPath(storedPath: string): string {
  if (!storedPath || typeof storedPath !== 'string') {
    throw new Error('Invalid file path');
  }

  let normalized = storedPath.trim();

  // Backward compatibility: some records may store full URLs.
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      normalized = new URL(normalized).pathname;
    } catch {
      throw new Error('Invalid file path');
    }
  }

  normalized = normalized.replace(/\\/g, '/');

  if (normalized.startsWith('/public/')) {
    normalized = normalized.slice('/public/'.length);
  }

  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  const uploadsIndex = normalized.indexOf('uploads/');
  if (uploadsIndex === -1) {
    throw new Error('Invalid file path');
  }

  normalized = normalized.slice(uploadsIndex);

  const uploadsDir = path.resolve(UPLOAD_DIR);
  const resolvedPath = path.resolve(path.join(process.cwd(), 'public', normalized));
  const safePrefix = `${uploadsDir}${path.sep}`;

  if (resolvedPath !== uploadsDir && !resolvedPath.startsWith(safePrefix)) {
    throw new Error('Invalid file path');
  }

  return resolvedPath;
}

/**
 * Ensure upload directory exists
 */
export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Upload file to local storage
 * @param fileName - Original file name
 * @param buffer - File buffer
 * @returns Relative path for storing in DB
 */
export async function uploadFile(fileName: string, buffer: Buffer): Promise<string> {
  await ensureUploadDir();

  // Create a safe filename with timestamp to avoid collisions
  const timestamp = Date.now();
  const safeFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeFileName);

  await fs.writeFile(filePath, buffer);

  // Return relative path (no leading slash for DB storage)
  return `uploads/${safeFileName}`;
}

/**
 * Download file from local storage
 * @param filePath - Relative path from DB (e.g., 'uploads/1234-file.pdf')
 * @returns Buffer
 */
export async function downloadFile(filePath: string): Promise<Buffer> {
  const resolvedPath = resolveSafeUploadPath(filePath);
  return await fs.readFile(resolvedPath);
}

/**
 * Get read stream for file (for streaming downloads)
 * @param filePath - Relative path from DB
 * @returns ReadStream
 */
export function getFileStream(filePath: string) {
  const resolvedPath = resolveSafeUploadPath(filePath);
  return createReadStream(resolvedPath);
}

/**
 * Delete file from local storage
 * @param filePath - Relative path from DB
 */
export async function deleteFile(filePath: string): Promise<void> {
  const resolvedPath = resolveSafeUploadPath(filePath);

  try {
    await fs.unlink(resolvedPath);
  } catch (error) {
    // File may already be deleted, ignore
    if ((error as any).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get file info (size, exists)
 * @param filePath - Relative path from DB
 */
export async function getFileInfo(filePath: string): Promise<{ size: number; exists: boolean }> {
  const resolvedPath = resolveSafeUploadPath(filePath);

  try {
    const stats = await fs.stat(resolvedPath);
    return { size: stats.size, exists: true };
  } catch {
    return { size: 0, exists: false };
  }
}
