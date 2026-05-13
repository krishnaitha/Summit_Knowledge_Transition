import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { logActivity, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { validateOrigin } from '@/lib/security';

const ALLOWED_RATINGS = new Set(['up', 'down']);

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      messageId: string;
      projectId: string;
      rating: 'up' | 'down';
      reasonTag?: string;
      comment?: string;
    };

    if (!body.messageId || !body.projectId || !body.rating || !ALLOWED_RATINGS.has(body.rating)) {
      return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 });
    }

    const canAccess = await userHasProjectAccess(userId, profile?.role, body.projectId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messageRows = await sql`
      SELECT cm.id
      FROM chat_messages cm
      JOIN chat_sessions cs ON cs.id = cm.session_id
      WHERE cm.id = ${body.messageId}
        AND cm.role = 'assistant'
        AND cs.project_id = ${body.projectId}
      LIMIT 1
    `;

    if (!messageRows.length) {
      return NextResponse.json({ error: 'Assistant message not found for this project' }, { status: 404 });
    }

    const reasonTag = body.reasonTag?.trim() || null;
    const comment = body.comment?.trim() || null;

    await sql`
      INSERT INTO chat_answer_feedback (user_id, project_id, message_id, rating, reason_tag, comment)
      VALUES (${userId}, ${body.projectId}, ${body.messageId}, ${body.rating}, ${reasonTag}, ${comment})
      ON CONFLICT (user_id, message_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        reason_tag = EXCLUDED.reason_tag,
        comment = EXCLUDED.comment,
        updated_at = now()
    `;

    await logActivity({
      userId,
      projectId: body.projectId,
      action: 'chat_answer_feedback',
      metadata: {
        messageId: body.messageId,
        rating: body.rating,
        reasonTag,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
