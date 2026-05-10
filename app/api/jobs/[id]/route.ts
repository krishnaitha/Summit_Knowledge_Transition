import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { user } = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { data: job, error } = await supabase
    .from('processing_jobs')
    .select('id, status, result, error, created_at, started_at, completed_at')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
