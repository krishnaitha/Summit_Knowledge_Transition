import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import sql from '@/lib/db';
import { validateOrigin } from '@/lib/security';

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

    const body = (await request.json()) as { documentId: string; projectId: string };

    // Verify document exists before queuing
    const docs = await sql`
      SELECT id FROM documents WHERE id = ${body.documentId}
    `;
    const document = docs[0] ?? null;

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Insert background job
    const jobs = await sql`
      INSERT INTO processing_jobs (type, payload)
      VALUES ('document_process', ${sql.json({ documentId: body.documentId, projectId: body.projectId })})
      RETURNING id
    `;
    const job = jobs[0] ?? null;

    if (!job) {
      return NextResponse.json({ error: 'Failed to queue processing job' }, { status: 500 });
    }

    // Trigger the worker asynchronously (fire-and-forget)
    const workerUrl = `${process.env.INTERNAL_APP_URL ?? 'http://localhost:3000'}/api/jobs/worker`;
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET ?? '',
      },
    }).catch(() => {
      /* worker will be retried on next upload */
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 },
    );
  }
}
