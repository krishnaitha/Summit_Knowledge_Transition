import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById, userHasProjectAccess } from '@/lib/data';
import { uploadDocumentToStorage } from '@/lib/documents/upload';
import { validateOrigin, validateUploadedFile } from '@/lib/security';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user } = await getCurrentUserContext();
    const supabase = createServiceRoleSupabaseClient();

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileById(user.id);

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

    const canAccess = await userHasProjectAccess(user.id, profile?.role, projectId);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storagePath = await uploadDocumentToStorage(projectId, file);
    const { data, error } = await supabase
      .from('documents')
      .insert({
        id: randomUUID(),
        project_id: projectId,
        file_name: file.name,
        file_url: storagePath,
        file_type: file.name.split('.').pop()?.toLowerCase() ?? 'txt',
        uploaded_by: user.id,
        chunk_count: 0,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ documentId: data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}
