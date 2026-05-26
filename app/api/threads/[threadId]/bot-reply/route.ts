import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { ensureBotFailureReply, processBotThreadReply } from '@/lib/documents/bot-reply';

// If a bot_thread_reply job has been pending for longer than this, the worker
// is likely not running. Process the reply inline in this request instead.
const INLINE_FALLBACK_AFTER_MS = 30_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;

  const { userId, profile } = await getCurrentUserContext();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch thread with everything needed to possibly enqueue or process a job
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

  if (thread.status !== 'open') {
    return NextResponse.json({ reply: null });
  }

  // Check the latest job so failed jobs can surface a final bot message.
  const jobRows = await sql<
    {
      id: string;
      created_at: string;
      job_query: string;
      status: string;
      error: string | null;
    }[]
  >`
    SELECT id, created_at, payload->>'query' AS job_query, status, error
    FROM processing_jobs
    WHERE type = 'bot_thread_reply'
      AND payload->>'threadId' = ${threadId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const job = jobRows[0];

  if (!job) {
    // No job queued yet — enqueue one (covers threads created before the bot feature)
    const firstCommentRows = await sql<{ body: string }[]>`
      SELECT body FROM document_thread_comments
      WHERE thread_id = ${threadId} AND is_bot = false
      ORDER BY created_at ASC LIMIT 1
    `;
    const query = `${thread.title} ${firstCommentRows[0]?.body ?? ''}`.slice(0, 1000);

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

    return NextResponse.json({ reply: null });
  }

  if (job.status === 'failed') {
    await ensureBotFailureReply(threadId);
    const failedReplyRows = await sql<{ body: string; created_at: string }[]>`
      SELECT body, created_at
      FROM document_thread_comments
      WHERE thread_id = ${threadId} AND is_bot = true
      ORDER BY created_at ASC
      LIMIT 1
    `;

    return NextResponse.json({ reply: failedReplyRows[0] ?? null });
  }

  if (job.status !== 'pending' && job.status !== 'running') {
    return NextResponse.json({ reply: null });
  }

  // Job exists — check if it has been sitting long enough that the worker
  // is likely not running, and fall back to inline processing.
  const jobAgeMs = Date.now() - new Date(job.created_at).getTime();
  if (jobAgeMs < INLINE_FALLBACK_AFTER_MS) {
    return NextResponse.json({ reply: null });
  }

  // Atomically claim the pending job to prevent concurrent requests from
  // both entering the inline path and inserting duplicate replies.
  const claimed = await sql<{ id: string }[]>`
    UPDATE processing_jobs
    SET status = 'running', started_at = now()
    WHERE id = ${job.id} AND status = 'pending'
    RETURNING id
  `;

  if (!claimed.length) {
    // Another concurrent request already claimed it
    return NextResponse.json({ reply: null });
  }

  try {
    await processBotThreadReply({
      threadId,
      projectId: thread.project_id,
      documentId: thread.document_id ?? '',
      query: job.job_query,
    });

    await sql`
      UPDATE processing_jobs
      SET status = 'done', completed_at = now()
      WHERE id = ${job.id}
    `;

    const newReply = await sql<{ body: string; created_at: string }[]>`
      SELECT body, created_at
      FROM document_thread_comments
      WHERE thread_id = ${threadId} AND is_bot = true
      ORDER BY created_at ASC LIMIT 1
    `;

    return NextResponse.json({ reply: newReply[0] ?? null });
  } catch {
    await sql`
      UPDATE processing_jobs
      SET status = 'failed', completed_at = now()
      WHERE id = ${job.id}
    `;

    await ensureBotFailureReply(threadId);
    const failedReplyRows = await sql<{ body: string; created_at: string }[]>`
      SELECT body, created_at
      FROM document_thread_comments
      WHERE thread_id = ${threadId} AND is_bot = true
      ORDER BY created_at ASC
      LIMIT 1
    `;

    return NextResponse.json({ reply: failedReplyRows[0] ?? null });
  }
}
