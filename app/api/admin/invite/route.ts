import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { validateOrigin } from '@/lib/security';
import sql from '@/lib/db';

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

    const body = (await request.json()) as { email: string; projectId?: string; fullName?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // If user already exists, just return their ID
    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing.length) {
      return NextResponse.json({ invited: true, userId: existing[0].id });
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await sql`
      INSERT INTO invite_tokens (email, token, role, project_id, expires_at)
      VALUES (${email}, ${token}, 'member', ${body.projectId ?? null}, ${expiresAt})
    `;

    // Send invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? 'notifications@summit.app';
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: 'You have been invited to Summit KT Portal',
          html: `
            <p>Hi${body.fullName ? ` ${body.fullName}` : ''},</p>
            <p>You have been invited to join <strong>Summit KT Portal</strong>.</p>
            <p>Click the link below to set your password and access your account:</p>
            <p><a href="${inviteLink}">${inviteLink}</a></p>
            <p>This link expires in 7 days.</p>
          `,
        });
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ invited: true, inviteLink });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invite failed' },
      { status: 500 },
    );
  }
}
