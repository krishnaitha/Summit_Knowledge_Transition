import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById } from '@/lib/data';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUserContext();
    const supabase = createServiceRoleSupabaseClient();

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileById(user.id);
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const projectId = String(body.projectId ?? '');
    const category = body.category === 'technical' ? 'technical' : 'functional';
    const numSets = Math.min(5, Math.max(1, Number(body.numSets) || 3));

    // Fail fast: ensure there are document chunks to generate from
    const { count } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (!count || count === 0) {
      return NextResponse.json(
        { error: 'No document content found. Upload and process KT documents first.' },
        { status: 400 },
      );
    }

    // Insert background job
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        type: 'quiz_generate',
        payload: { projectId, category, numSets },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to queue generation job' }, { status: 500 });
    }

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
