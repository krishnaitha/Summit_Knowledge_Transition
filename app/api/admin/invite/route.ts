import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById } from '@/lib/data';
import { validateOrigin } from '@/lib/security';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user } = await getCurrentUserContext();
    const supabase = createServiceRoleSupabaseClient();

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileById(user.id);

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { email: string; projectId?: string; fullName?: string };
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(body.email, {
      redirectTo: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : undefined,
      data: {
        full_name: body.fullName,
      },
    });

    if (error) {
      throw error;
    }

    await supabase.from('users').upsert({
      id: data.user.id,
      email: body.email,
      full_name: body.fullName ?? null,
      role: 'member',
      is_active: true,
    });

    if (body.projectId) {
      await supabase.from('project_members').upsert({ project_id: body.projectId, user_id: data.user.id });
    }

    return NextResponse.json({ invited: true, userId: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invite failed' }, { status: 500 });
  }
}