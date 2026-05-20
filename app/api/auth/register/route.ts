import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { requireCredentialsProvider } from '@/lib/auth/guard';
import sql from '@/lib/db';

export async function POST(request: Request) {
  const guard = requireCredentialsProvider();
  if (guard) return guard;

  try {
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
    };

    const fullName = String(body.fullName ?? '').trim();
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body.password ?? '');

    if (!fullName) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    if (!email || !email.includes('@'))
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    if (!password || password.length < 8)
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 },
      );

    // Check if email already registered under the credentials provider
    const existing =
      await sql`SELECT id FROM users WHERE email = ${email} AND auth_provider = 'credentials' LIMIT 1`;
    if (existing.length) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await sql`
      INSERT INTO users (email, full_name, role, password_hash, is_active)
      VALUES (${email}, ${fullName}, 'member', ${passwordHash}, true)
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 500 },
    );
  }
}
