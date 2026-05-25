import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import sql from '@/lib/db';

function normalizeSessionTitle(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 80);
}

let hasEnsuredChatSessionTitleSchema = false;

async function ensureChatSessionTitleSchema() {
  if (hasEnsuredChatSessionTitleSchema) return;

  try {
    await sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title text`;
    hasEnsuredChatSessionTitleSchema = true;
  } catch {
    // Non-fatal: request handlers will still return actionable errors.
  }
}

export async function GET(request: Request) {
  try {
    await ensureChatSessionTitleSchema();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const { userId } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await sql<
      Array<{
        id: string;
        title: string | null;
        last_message_at: string | null;
        message_count: number;
      }>
    >`
      SELECT id, title, last_message_at, message_count
      FROM chat_sessions
      WHERE user_id = ${userId} AND project_id = ${projectId}
      ORDER BY last_message_at DESC NULLS LAST, started_at DESC
    `;

    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sessions' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureChatSessionTitleSchema();

    const body = (await request.json()) as { sessionId?: string; title?: string };

    if (!body.sessionId || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'sessionId and title required' }, { status: 400 });
    }

    const title = normalizeSessionTitle(body.title);

    if (!title) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }

    const { userId } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql<Array<{ id: string; title: string | null }>>`
      UPDATE chat_sessions
      SET title = ${title}
      WHERE id = ${body.sessionId} AND user_id = ${userId}
      RETURNING id, title
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rename session' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const { userId } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql<Array<{ id: string }>>`
      DELETE FROM chat_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
      RETURNING id
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deletedId: rows[0].id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete session' },
      { status: 500 },
    );
  }
}
