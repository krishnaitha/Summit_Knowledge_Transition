import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'summit-documents';

let _client: S3Client | undefined;

// Lazy-initialised — only throws when actually called, so a local-storage
// deployment that never touches R2 will not crash at module load time.
function getR2(): S3Client {
  if (!_client) {
    if (!process.env.R2_ACCOUNT_ID) throw new Error('R2_ACCOUNT_ID is required');
    if (!process.env.R2_ACCESS_KEY_ID) throw new Error('R2_ACCESS_KEY_ID is required');
    if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error('R2_SECRET_ACCESS_KEY is required');
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

export async function downloadFromR2(key: string): Promise<NodeJS.ReadableStream> {
  const r2 = getR2();
  const response = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));

  if (!response.Body || typeof (response.Body as NodeJS.ReadableStream).pipe !== 'function') {
    throw new Error('R2 object body is unavailable');
  }

  return response.Body as NodeJS.ReadableStream;
}

export async function deleteFromR2(key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
