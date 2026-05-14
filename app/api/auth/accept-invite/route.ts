import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireCredentialsProvider } from "@/lib/auth/guard";
import sql from "@/lib/db";

export async function POST(request: Request) {
  const guard = requireCredentialsProvider();
  if (guard) return guard;

  try {
    const body = (await request.json()) as {
      token: string;
      fullName: string;
      password: string;
    };

    const { token, fullName, password } = body;

    if (!token || !fullName?.trim() || !password || password.length < 8) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Look up and claim the token atomically
    const rows = await sql`
      DELETE FROM invite_tokens
      WHERE token = ${token} AND expires_at > now()
      RETURNING email, role, project_id
    `;

    if (!rows.length) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link." },
        { status: 400 },
      );
    }

    const {
      email,
      role,
      project_id: projectId,
    } = rows[0] as {
      email: string;
      role: string;
      project_id: string | null;
    };

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (or update if somehow already exists)
    const userRows = await sql`
      INSERT INTO users (email, full_name, role, password_hash, is_active)
      VALUES (${email}, ${fullName.trim()}, ${role}, ${passwordHash}, true)
      ON CONFLICT (email) DO UPDATE
        SET full_name = excluded.full_name,
            password_hash = excluded.password_hash,
            is_active = true
      RETURNING id
    `;

    const userId = userRows[0]?.id as string;

    // Auto-assign to project if token had one
    if (projectId && userId) {
      await sql`
        INSERT INTO project_members (project_id, user_id)
        VALUES (${projectId}, ${userId})
        ON CONFLICT (project_id, user_id) DO NOTHING
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to accept invite",
      },
      { status: 500 },
    );
  }
}
