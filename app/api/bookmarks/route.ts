import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messageId: string; projectId: string };

    if (!body.messageId || !body.projectId) {
      return NextResponse.json({ error: 'messageId and projectId required' }, { status: 400 });
    }

    const { userId } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const rows = await sql`
        INSERT INTO chat_bookmarks (user_id, project_id, message_id)
        VALUES (${userId}, ${body.projectId}, ${body.messageId})
        RETURNING id
      `;
      return NextResponse.json({ id: rows[0].id });
    } catch (err: unknown) {
      // Unique violation = already bookmarked — treat as success
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        return NextResponse.json({ id: null, alreadyBookmarked: true });
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 });
    }

    const { userId } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await sql`
      DELETE FROM chat_bookmarks
      WHERE user_id = ${userId}
        AND message_id = ${messageId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
