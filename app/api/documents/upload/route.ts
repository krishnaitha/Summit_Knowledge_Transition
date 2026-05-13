import { randomUUID } from 'crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { uploadDocumentToStorage } from '@/lib/documents/upload';
import { validateOrigin, validateUploadedFile } from '@/lib/security';

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const projectId = String(formData.get('projectId') ?? '');
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 });
    }

    const fileError = await validateUploadedFile(file);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const canAccess = await userHasProjectAccess(userId, profile?.role, projectId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storagePath = await uploadDocumentToStorage(projectId, file);

    const rows = await sql`
      INSERT INTO documents (id, project_id, file_name, file_url, file_type, uploaded_by, chunk_count)
      VALUES (
        ${randomUUID()}, ${projectId}, ${file.name}, ${storagePath},
        ${file.name.split('.').pop()?.toLowerCase() ?? 'txt'}, ${userId}, 0
      )
      RETURNING id
    `;

    revalidateTag(`project-docs:${projectId}`, 'max');
    return NextResponse.json({ documentId: rows[0].id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
