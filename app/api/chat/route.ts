import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProjectById, logActivity, userHasProjectAccess } from '@/lib/data';
import { buildKtPrompt, createGroqChatCompletion } from '@/lib/groq/chat';
import { streamGroqText } from '@/lib/groq/streaming';
import { checkRateLimit } from '@/lib/rate-limit';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';
import { validateOrigin } from '@/lib/security';
import sql from '@/lib/db';
import type { RagTraceRecord } from '@/lib/types/database';

const answerCache = new Map<string, string>();

const NO_MATCH_THRESHOLD = 0.20;
const HALLUCINATION_THRESHOLD = 0.35;
const NOT_FOUND_MSG =
  'I could not find enough information in the KT documents to answer this question. ' +
  'This may indicate a gap in the knowledge base — consider asking your admin to add relevant documentation.';

async function writeRagTrace(
  trace: Omit<RagTraceRecord, 'id' | 'created_at' | 'is_slow'>,
): Promise<void> {
  try {
    await sql`
      INSERT INTO rag_traces (
        project_id, user_id, session_id, message_id, query_text,
        chunks_retrieved, max_similarity, avg_similarity, retrieval_hit, retrieval_ms,
        model_used, prompt_tokens, completion_tokens, total_tokens, generation_ms,
        total_ms, answer_cached, answer_refused, possible_hallucination
      ) VALUES (
        ${trace.project_id}, ${trace.user_id}, ${trace.session_id}, ${trace.message_id}, ${trace.query_text},
        ${trace.chunks_retrieved}, ${trace.max_similarity ?? null}, ${trace.avg_similarity ?? null},
        ${trace.retrieval_hit}, ${trace.retrieval_ms ?? null},
        ${trace.model_used ?? null}, ${trace.prompt_tokens ?? null}, ${trace.completion_tokens ?? null},
        ${trace.total_tokens ?? null}, ${trace.generation_ms ?? null},
        ${trace.total_ms}, ${trace.answer_cached}, ${trace.answer_refused}, ${trace.possible_hallucination}
      )
    `;
  } catch {
    // Intentionally silent — observability must never break chat
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { userId } = await getCurrentUserContext();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessions = await sql`
    SELECT id FROM chat_sessions WHERE id = ${sessionId} AND user_id = ${userId} LIMIT 1
  `;

  if (!sessions.length) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const messages = await sql`
    SELECT * FROM chat_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
  `;

  // Normalize sources: postgres.js may return JSONB as a string if it was stored via JSON.stringify()
  const normalizedMessages = messages.map((m) => {
    let sources = m.sources;
    if (typeof sources === 'string') {
      try { sources = JSON.parse(sources); } catch { sources = null; }
    }
    return { ...m, sources: Array.isArray(sources) ? sources : null };
  });

  const messageIds = normalizedMessages.map((m) => m.id as string);
  const bookmarks = messageIds.length
    ? await sql`SELECT message_id FROM chat_bookmarks WHERE user_id = ${userId} AND message_id = ANY(${messageIds})`
    : [];

  return NextResponse.json({
    messages: normalizedMessages,
    bookmarkedMessageIds: bookmarks.map((b) => b.message_id),
  });
}

export async function POST(request: Request) {
  const t0 = Date.now();

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

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 30 chat messages per hour per user
    const rateCheck = await checkRateLimit(userId, 'chatbot_message', 30, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Message limit reached. Please try again later.' }, { status: 429 });
    }

    const canAccess = await userHasProjectAccess(userId, profile?.role as string | undefined, body.projectId);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const project = await getProjectById(body.projectId);
    const chunks = await retrieveRelevantChunks(body.projectId, body.message);
    const t1 = Date.now();
    const retrieval_ms = t1 - t0;

    // Confidence gate — if no chunk clears the minimum threshold, return a hard
    // "not found" response without calling the LLM, and log a knowledge gap.
    const maxSimilarity = chunks.length > 0 ? Math.max(...chunks.map((c) => c.similarity)) : 0;
    const avgSimilarity =
      chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length : 0;

    if (chunks.length === 0 || maxSimilarity < NO_MATCH_THRESHOLD) {
      let gapSessionId = body.sessionId ?? null;

      if (!gapSessionId) {
        const newSessions = await sql`
          INSERT INTO chat_sessions (user_id, project_id, message_count)
          VALUES (${userId}, ${body.projectId}, 0)
          RETURNING id
        `;
        gapSessionId = (newSessions[0]?.id as string) ?? null;
      }

      if (gapSessionId) {
        await sql`
          INSERT INTO chat_messages (session_id, role, content, sources)
          VALUES (${gapSessionId}, 'user', ${body.message}, ${null})
        `;
        await sql`
          INSERT INTO chat_messages (session_id, role, content, sources)
          VALUES (${gapSessionId}, 'assistant', ${NOT_FOUND_MSG}, ${sql.json([])})
        `;
        await sql`
          UPDATE chat_sessions
          SET message_count = 2, last_message_at = ${new Date().toISOString()}
          WHERE id = ${gapSessionId}
        `;
      }

      await logActivity({
        userId,
        projectId: body.projectId,
        action: 'knowledge_gap',
        metadata: { query: body.message, maxSimilarity },
      });

      writeRagTrace({
        project_id: body.projectId,
        user_id: userId,
        session_id: gapSessionId,
        message_id: null,
        query_text: body.message,
        chunks_retrieved: chunks.length,
        max_similarity: maxSimilarity || null,
        avg_similarity: avgSimilarity || null,
        retrieval_hit: false,
        retrieval_ms,
        model_used: null,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        generation_ms: null,
        total_ms: Date.now() - t0,
        answer_cached: false,
        answer_refused: true,
        possible_hallucination: false,
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
      const newSessions = await sql`
        INSERT INTO chat_sessions (user_id, project_id, message_count)
        VALUES (${userId}, ${body.projectId}, 0)
        RETURNING id
      `;
      sessionId = (newSessions[0]?.id as string) ?? null;
    }

    await sql`
      INSERT INTO chat_messages (session_id, role, content, sources)
      VALUES (${sessionId}, 'user', ${body.message}, ${null})
    `;

    if (answerCache.has(cacheKey)) {
      const cachedAnswer = answerCache.get(cacheKey)!;

      await sql`
        INSERT INTO chat_messages (session_id, role, content, sources)
        VALUES (${sessionId}, 'assistant', ${cachedAnswer}, ${sql.json(sources)})
      `;

      const countRows = await sql`SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ${sessionId}`;
      const count = Number(countRows[0]?.c ?? 0);

      await sql`
        UPDATE chat_sessions
        SET message_count = ${count}, last_message_at = ${new Date().toISOString()}
        WHERE id = ${sessionId}
      `;

      await logActivity({ userId, projectId: body.projectId, action: 'chatbot_message', metadata: { cached: true } });

      writeRagTrace({
        project_id: body.projectId,
        user_id: userId,
        session_id: sessionId,
        message_id: null,
        query_text: body.message,
        chunks_retrieved: chunks.length,
        max_similarity: maxSimilarity,
        avg_similarity: avgSimilarity,
        retrieval_hit: true,
        retrieval_ms,
        model_used: null,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        generation_ms: null,
        total_ms: Date.now() - t0,
        answer_cached: true,
        answer_refused: false,
        possible_hallucination: maxSimilarity < HALLUCINATION_THRESHOLD,
      });

      return new NextResponse(cachedAnswer, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-session-id': sessionId ?? '',
          'x-sources': JSON.stringify(sources),
        },
      });
    }

    const systemPrompt = buildKtPrompt(project?.name ?? body.projectName ?? 'Project', context);

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (text: string) => controller.enqueue(new TextEncoder().encode(text));
        const tGenStart = Date.now();

        let completion;

        try {
          completion = await createGroqChatCompletion(
            {
              stream: true,
              max_tokens: 1024,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              stream_options: { include_usage: true } as any,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: body.message },
              ],
            },
            (statusMessage) => enqueue(`\x00${statusMessage}`),
          );
        } catch {
          enqueue('\x00Failed to reach the AI. Please try again.');
          controller.close();
          return;
        }

        const { text: generated, usage, modelUsed } = await streamGroqText(completion, (token) => enqueue(token));
        const generation_ms = Date.now() - tGenStart;

        answerCache.set(cacheKey, generated);

        const assistantMsgRows = await sql`
          INSERT INTO chat_messages (session_id, role, content, sources)
          VALUES (${sessionId}, 'assistant', ${generated}, ${sql.json(sources)})
          RETURNING id
        `;
        const assistantMsgId = (assistantMsgRows[0]?.id as string) ?? null;

        const countRows = await sql`SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ${sessionId}`;
        const count = Number(countRows[0]?.c ?? 0);

        await sql`
          UPDATE chat_sessions
          SET message_count = ${count}, last_message_at = ${new Date().toISOString()}
          WHERE id = ${sessionId}
        `;

        await logActivity({ userId, projectId: body.projectId, action: 'chatbot_message', metadata: { cached: false } });

        controller.close();

        writeRagTrace({
          project_id: body.projectId,
          user_id: userId,
          session_id: sessionId,
          message_id: assistantMsgId,
          query_text: body.message,
          chunks_retrieved: chunks.length,
          max_similarity: maxSimilarity,
          avg_similarity: avgSimilarity,
          retrieval_hit: true,
          retrieval_ms,
          model_used: modelUsed,
          prompt_tokens: usage?.prompt_tokens ?? null,
          completion_tokens: usage?.completion_tokens ?? null,
          total_tokens: usage?.total_tokens ?? null,
          generation_ms,
          total_ms: Date.now() - t0,
          answer_cached: false,
          answer_refused: false,
          possible_hallucination: maxSimilarity < HALLUCINATION_THRESHOLD,
        });
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
