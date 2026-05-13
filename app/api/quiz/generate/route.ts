import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const projectId = String(body.projectId ?? '');
    const category = body.category === 'technical' ? 'technical' : 'functional';
    const numSets = Math.min(5, Math.max(1, Number(body.numSets) || 3));

    // Fail fast: ensure there are document chunks to generate from
    const countRows = await sql`
      SELECT COUNT(*) AS c FROM document_chunks WHERE project_id = ${projectId}
    `;
    const count = Number(countRows[0]?.c ?? 0);

    if (count === 0) {
      return NextResponse.json(
        { error: 'No document content found. Upload and process KT documents first.' },
        { status: 400 },
      );
    }

    // Insert background job
    const jobs = await sql`
      INSERT INTO processing_jobs (type, payload)
      VALUES ('quiz_generate', ${sql.json({ projectId, category, numSets })})
      RETURNING id
    `;
    const job = jobs[0] ?? null;

    if (!job) {
      return NextResponse.json({ error: 'Failed to queue generation job' }, { status: 500 });
    }

    // Kick the worker immediately (fire-and-forget)
    const workerUrl = `${process.env.INTERNAL_APP_URL ?? 'http://localhost:3000'}/api/jobs/worker`;
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET ?? '',
      },
    }).catch(() => {
      /* worker will run on next trigger */
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
