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
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile?.role !== 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await request.json()) as { projectId: string; reason?: string };
    const projectId = String(body.projectId ?? '');
    const reason = String(body.reason ?? '').trim() || null;

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Check there is a submitted attempt to request a retake for
    const attempts = await sql`
      SELECT id FROM quiz_attempts
      WHERE user_id = ${userId} AND project_id = ${projectId} AND status = 'submitted'
      LIMIT 1
    `;
    if (!attempts.length) {
      return NextResponse.json({ error: 'No submitted attempt found for this project.' }, { status: 400 });
    }
    const attemptId = attempts[0].id as string;

    // Check for an already-pending request
    const existing = await sql`
      SELECT id FROM quiz_retake_requests
      WHERE user_id = ${userId} AND project_id = ${projectId} AND status = 'pending'
      LIMIT 1
    `;
    if (existing.length) {
      return NextResponse.json({ error: 'You already have a pending re-enable request for this project.' }, { status: 409 });
    }

    await sql`
      INSERT INTO quiz_retake_requests (user_id, project_id, attempt_id, reason)
      VALUES (${userId}, ${projectId}, ${attemptId}, ${reason})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 },
    );
  }
}
