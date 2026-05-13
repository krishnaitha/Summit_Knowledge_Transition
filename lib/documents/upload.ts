import 'server-only';

import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { r2, R2_BUCKET } from '@/lib/storage/r2';

export async function uploadDocumentToStorage(projectId: string, file: File) {
  const extension = file.name.split('.').pop() ?? 'bin';
  const path = `${projectId}/${randomUUID()}.${extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: body,
      ContentType: file.type,
    }),
  );

  return path;
}
