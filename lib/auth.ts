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
