import 'server-only';

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/auth';
import sql from '@/lib/db';
import type { UserProfile } from '@/lib/types/database';

export async function getCurrentUserContext() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (!userId) {
    return { user: null, userId: null, profile: null as UserProfile | null };
  }

  const rows = await sql<UserProfile[]>`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
  const profile = rows[0] ?? null;

  return {
    user: session!.user,
    userId,
    profile,
  };
}

export async function requireAuthenticatedUser() {
  const context = await getCurrentUserContext();

  if (!context.userId) {
    redirect('/login');
  }

  return context;
}

export async function requireAdmin() {
  const context = await requireAuthenticatedUser();

  if (context.profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return context;
}

export async function requireMember() {
  const context = await requireAuthenticatedUser();

  if (context.profile?.role === 'admin') {
    redirect('/admin/dashboard');
  }

  return context;
}

// Returns project IDs where the user is a project-level admin
export async function getProjectAdminIds(userId: string): Promise<string[]> {
  const rows = await sql<{ project_id: string }[]>`
    SELECT project_id FROM project_members WHERE user_id = ${userId} AND role = 'admin'
  `;
  return rows.map((r) => r.project_id);
}

// Allows both global admins and project admins for the specific project
export async function requireProjectAdmin(projectId: string) {
  const context = await requireAuthenticatedUser();

  if (context.profile?.role === 'admin') return context;

  const adminProjectIds = await getProjectAdminIds(context.userId!);
  if (adminProjectIds.includes(projectId)) return context;

  redirect('/dashboard');
}

// Allows through if global admin OR project admin for any project
export async function requireAnyAdmin() {
  const context = await requireAuthenticatedUser();

  if (context.profile?.role === 'admin') return context;

  const adminProjectIds = await getProjectAdminIds(context.userId!);
  if (adminProjectIds.length > 0) return context;

  redirect('/dashboard');
}
