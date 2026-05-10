import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messageId: string; projectId: string };

    if (!body.messageId || !body.projectId) {
      return NextResponse.json({ error: 'messageId and projectId required' }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const { user } = await getCurrentUserContext();

    if (!supabase || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('chat_bookmarks')
      .insert({ user_id: user.id, project_id: body.projectId, message_id: body.messageId })
      .select('id')
      .single();

    if (error) {
      // Unique violation = already bookmarked — treat as success
      if (error.code === '23505') {
        return NextResponse.json({ id: null, alreadyBookmarked: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
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

    const supabase = createServiceRoleSupabaseClient();
    const { user } = await getCurrentUserContext();

    if (!supabase || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await supabase
      .from('chat_bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('message_id', messageId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
