import 'server-only';

import { randomUUID } from 'crypto';
import { uploadFile } from '@/lib/storage/local';

export async function uploadDocumentToStorage(projectId: string, file: File) {
  const extension = file.name.split('.').pop() ?? 'bin';
  const fileName = `${projectId}-${randomUUID()}.${extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  const path = await uploadFile(fileName, body);

  return path;
}
