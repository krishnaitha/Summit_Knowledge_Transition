import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireCredentialsProvider } from "@/lib/auth/guard";
import sql from "@/lib/db";

export async function POST(request: Request) {
  const guard = requireCredentialsProvider();
  if (guard) return guard;

  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
    };
    const { token, password } = body;

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Claim token atomically
    const rows = await sql`
      DELETE FROM password_reset_tokens
      WHERE token = ${token} AND expires_at > now()
      RETURNING email
    `;

    if (!rows.length) {
      return NextResponse.json(
        {
          error:
            "Reset link has expired or already been used. Please request a new one.",
        },
        { status: 400 },
      );
    }

    const email = rows[0].email as string;
    const passwordHash = await bcrypt.hash(password, 12);

    const updated = await sql`
      UPDATE users SET password_hash = ${passwordHash}
      WHERE email = ${email} AND is_active = true
      RETURNING id
    `;

    if (!updated.length) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 500 },
    );
  }
}
