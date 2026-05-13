import 'server-only';

/**
 * Validates the Origin header on incoming requests to guard against CSRF.
 * Same-origin requests typically omit the Origin header — those are allowed.
 * Cross-origin requests must originate from NEXT_PUBLIC_APP_URL.
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    return origin === new URL(appUrl).origin;
  } catch {
    return true;
  }
}

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'pptx', 'ppt', 'txt', 'csv']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Magic bytes for binary formats
const MAGIC: Record<string, number[]> = {
  pdf:  [0x25, 0x50, 0x44, 0x46],       // %PDF
  docx: [0x50, 0x4b, 0x03, 0x04],       // PK.. (ZIP-based Office Open XML)
  xlsx: [0x50, 0x4b, 0x03, 0x04],       // PK.. (ZIP-based Office Open XML)
  pptx: [0x50, 0x4b, 0x03, 0x04],       // PK.. (ZIP-based Office Open XML)
  ppt:  [0xd0, 0xcf, 0x11, 0xe0],       // OLE2 compound document
};

/**
 * Validates an uploaded File object server-side:
 * - Extension must be in the allowed list
 * - Size must not exceed 3 MB
 * - Binary types (PDF, DOCX) must match their magic bytes
 *
 * Returns an error string if invalid, or null if the file is acceptable.
 */
export async function validateUploadedFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `File type ".${ext}" is not allowed. Accepted types: PDF, DOCX, XLSX, PPTX, PPT, TXT, CSV.`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" exceeds the 5 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }

  if (MAGIC[ext]) {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const valid = MAGIC[ext].every((byte, i) => header[i] === byte);
    if (!valid) {
      return `File "${file.name}" does not appear to be a valid ${ext.toUpperCase()} file.`;
    }
  }

  return null;
}
