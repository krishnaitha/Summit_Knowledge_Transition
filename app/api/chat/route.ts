import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProjectById, getProfileById, logActivity, userHasProjectAccess } from '@/lib/data';
import { buildKtPrompt, createGroqChatCompletion } from '@/lib/groq/chat';
import { streamGroqText } from '@/lib/groq/streaming';
import { checkRateLimit } from '@/lib/rate-limit';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';
import { validateOrigin } from '@/lib/security';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

const answerCache = new Map<string, string>();

const NO_MATCH_THRESHOLD = 0.20;
const NOT_FOUND_MSG =
  'I could not find enough information in the KT documents to answer this question. ' +
  'This may indicate a gap in the knowledge base — consider asking your admin to add relevant documentation.';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { user } = await getCurrentUserContext();

  if (!supabase || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: bookmarks } = messageIds.length
    ? await supabase
        .from('chat_bookmarks')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds)
    : { data: [] };

  return NextResponse.json({
    messages: messages ?? [],
    bookmarkedMessageIds: (bookmarks ?? []).map((b) => b.message_id),
  });
}

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      projectId: string;
      projectName?: string;
      sessionId?: string | null;
      message: string;
    };

    const supabase = createServiceRoleSupabaseClient();
    const { user } = await getCurrentUserContext();

    if (!supabase || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileById(user.id);

    // Rate limit: 30 chat messages per hour per user
    const rateCheck = await checkRateLimit(user.id, 'chatbot_message', 30, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Message limit reached. Please try again later.' }, { status: 429 });
    }

    const canAccess = await userHasProjectAccess(user.id, profile?.role, body.projectId);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const project = await getProjectById(body.projectId);
    const chunks = await retrieveRelevantChunks(body.projectId, body.message);

    // Confidence gate — if no chunk clears the minimum threshold, return a hard
    // "not found" response without calling the LLM, and log a knowledge gap.
    const maxSimilarity = chunks.length > 0 ? Math.max(...chunks.map((c) => c.similarity)) : 0;

    if (chunks.length === 0 || maxSimilarity < NO_MATCH_THRESHOLD) {
      let gapSessionId = body.sessionId ?? null;

      if (!gapSessionId) {
        const { data: newSession } = await supabase
          .from('chat_sessions')
          .insert({ user_id: user.id, project_id: body.projectId, message_count: 0 })
          .select('id')
          .single();
        gapSessionId = newSession?.id ?? null;
      }

      if (gapSessionId) {
        await supabase.from('chat_messages').insert([
          { session_id: gapSessionId, role: 'user',      content: body.message,  sources: null },
          { session_id: gapSessionId, role: 'assistant', content: NOT_FOUND_MSG, sources: [] },
        ]);
        await supabase
          .from('chat_sessions')
          .update({ message_count: 2, last_message_at: new Date().toISOString() })
          .eq('id', gapSessionId);
      }

      await logActivity({
        userId: user.id,
        projectId: body.projectId,
        action: 'knowledge_gap',
        metadata: { query: body.message, maxSimilarity },
      });

      return new NextResponse(NOT_FOUND_MSG, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-session-id': gapSessionId ?? '',
          'x-sources': JSON.stringify([]),
        },
      });
    }

    // Sources now carry the similarity score for confidence display in the UI
    const sources = chunks.map((chunk) => ({
      documentName: chunk.document_name,
      documentId: chunk.document_id,
      chunkId: chunk.id,
      similarity: chunk.similarity,
    }));

    const context = chunks.map((chunk) => `[${chunk.document_name}] ${chunk.content}`).join('\n\n');
    const cacheKey = `${body.projectId}:${body.message.trim().toLowerCase()}`;

    let sessionId = body.sessionId ?? null;

    if (!sessionId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, project_id: body.projectId, message_count: 0 })
        .select('*')
        .single();
      sessionId = session.id;
    }

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: body.message,
      sources: null,
    });

    if (answerCache.has(cacheKey)) {
      const cachedAnswer = answerCache.get(cacheKey)!;

      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: cachedAnswer,
        sources,
      });

      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      await supabase
        .from('chat_sessions')
        .update({ message_count: count ?? 2, last_message_at: new Date().toISOString() })
        .eq('id', sessionId);

      await logActivity({ userId: user.id, projectId: body.projectId, action: 'chatbot_message', metadata: { cached: true } });

      return new NextResponse(cachedAnswer, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-session-id': sessionId ?? '',
          'x-sources': JSON.stringify(sources),
        },
      });
    }

    const systemPrompt = buildKtPrompt(project?.name ?? body.projectName ?? 'Project', context);
    let generated = '';

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (text: string) => controller.enqueue(new TextEncoder().encode(text));

        let completion;

        try {
          completion = await createGroqChatCompletion(
            {
              stream: true,
              max_tokens: 1024,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: body.message },
              ],
            },
            (statusMessage) => enqueue(`\x00${statusMessage}`),
          );
        } catch (err) {
          enqueue('\x00Failed to reach the AI. Please try again.');
          controller.close();
          return;
        }

        generated = await streamGroqText(completion, (token) => enqueue(token));

        answerCache.set(cacheKey, generated);

        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: generated,
          sources,
        });

        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId);

        await supabase
          .from('chat_sessions')
          .update({ message_count: count ?? 2, last_message_at: new Date().toISOString() })
          .eq('id', sessionId);

        await logActivity({ userId: user.id, projectId: body.projectId, action: 'chatbot_message', metadata: { cached: false } });

        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-session-id': sessionId ?? '',
        'x-sources': JSON.stringify(sources),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chat failed' }, { status: 500 });
  }
}
