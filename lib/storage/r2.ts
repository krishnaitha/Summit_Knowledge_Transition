import { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

if (!process.env.R2_ACCOUNT_ID) throw new Error('R2_ACCOUNT_ID is required');
if (!process.env.R2_ACCESS_KEY_ID) throw new Error('R2_ACCESS_KEY_ID is required');
if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error('R2_SECRET_ACCESS_KEY is required');

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'summit-documents';

export async function downloadFromR2(key: string): Promise<NodeJS.ReadableStream> {
  const response = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));

  if (!response.Body || typeof (response.Body as NodeJS.ReadableStream).pipe !== 'function') {
    throw new Error('R2 object body is unavailable');
  }

  return response.Body as NodeJS.ReadableStream;
}
