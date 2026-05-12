import crypto from 'crypto';
import { NextResponse } from 'next/server';

import sql from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = String(body.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Always respond with success to avoid leaking whether an email exists
    const users = await sql`SELECT id FROM users WHERE email = ${email} AND is_active = true LIMIT 1`;

    if (users.length) {
      // Delete any existing reset tokens for this email
      await sql`DELETE FROM password_reset_tokens WHERE email = ${email}`;

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      await sql`
        INSERT INTO password_reset_tokens (email, token, expires_at)
        VALUES (${email}, ${token}, ${expiresAt})
      `;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const resetLink = `${appUrl}/auth/reset-password?token=${token}`;

      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM_EMAIL ?? 'notifications@summit.app';

        await resend.emails.send({
          from,
          to: email,
          subject: 'Reset your Summit KT Portal password',
          html: `
            <p>Hi,</p>
            <p>We received a request to reset your password for Summit KT Portal.</p>
            <p>Click the link below to set a new password. This link expires in 1 hour.</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          `,
        }).catch(() => { /* non-fatal */ });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 },
    );
  }
}
