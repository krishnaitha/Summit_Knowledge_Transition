import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { userId } = await getCurrentUserContext();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await sql`
    SELECT id, status, result, error, created_at, started_at, completed_at
    FROM processing_jobs
    WHERE id = ${params.id}
    LIMIT 1
  `;
  const job = rows[0] ?? null;

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
