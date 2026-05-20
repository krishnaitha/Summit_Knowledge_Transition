import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;

  const { userId, profile } = await getCurrentUserContext();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch thread with everything needed to possibly enqueue a job
  const threads = await sql<
    {
      project_id: string;
      document_id: string | null;
      title: string;
      status: string;
    }[]
  >`
    SELECT project_id, document_id, title, status
    FROM document_threads WHERE id = ${threadId} LIMIT 1
  `;
  const thread = threads[0];

  if (!thread) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const canAccess = await userHasProjectAccess(userId, profile?.role, thread.project_id);
  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Return immediately if a bot reply already exists
  const replyRows = await sql<{ body: string; created_at: string }[]>`
    SELECT body, created_at
    FROM document_thread_comments
    WHERE thread_id = ${threadId} AND is_bot = true
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (replyRows[0]) {
    return NextResponse.json({ reply: replyRows[0] });
  }

  // For open threads with no bot reply, auto-enqueue a job if none is queued yet.
  // This covers threads that existed before the bot reply feature was added.
  if (thread.status === 'open') {
    const pending = await sql`
      SELECT id FROM processing_jobs
      WHERE type = 'bot_thread_reply'
        AND status IN ('pending', 'running')
        AND payload->>'threadId' = ${threadId}
      LIMIT 1
    `;

    if (!pending.length) {
      const firstCommentRows = await sql<{ body: string }[]>`
        SELECT body FROM document_thread_comments
        WHERE thread_id = ${threadId} AND is_bot = false
        ORDER BY created_at ASC
        LIMIT 1
      `;
      const firstBody = firstCommentRows[0]?.body ?? '';
      const query = `${thread.title} ${firstBody}`.slice(0, 1000);

      const payload = {
        threadId,
        projectId: thread.project_id,
        documentId: thread.document_id ?? '',
        query,
      } as unknown as Parameters<typeof sql.json>[0];

      await sql`
        INSERT INTO processing_jobs (type, payload)
        VALUES ('bot_thread_reply', ${sql.json(payload)})
      `;
    }
  }

  return NextResponse.json({ reply: null });
}
