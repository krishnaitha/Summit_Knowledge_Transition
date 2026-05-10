import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById } from '@/lib/data';
import { validateOrigin } from '@/lib/security';
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

    const body = (await request.json()) as { documentId: string; projectId: string };

    // Verify document exists before queuing
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', body.documentId)
      .maybeSingle();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Insert background job
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        type: 'document_process',
        payload: { documentId: body.documentId, projectId: body.projectId },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to queue processing job' }, { status: 500 });
    }

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 },
    );
  }
}
