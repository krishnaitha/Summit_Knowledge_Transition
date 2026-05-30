import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProjectById, logActivity, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { buildKtPrompt, createGroqChatCompletion } from '@/lib/groq/chat';
import { streamGroqText } from '@/lib/groq/streaming';
import { createChatCompletion, getCurrentLlmProvider } from '@/lib/llm';
import {
  buildMemoryContext,
  parseMemoryConfirmation,
  parseRememberIntent,
  selectRelevantMemories,
} from '@/lib/memory';
import {
  clearPendingMemoryConfirmation,
  createPendingMemoryConfirmation,
  ensureUserMemorySchema,
  getPendingMemoryConfirmation,
  listUserMemories,
  touchUserMemories,
  upsertUserMemory,
} from '@/lib/memory-store';
import { logApplicationError } from '@/lib/observability';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/security';
import type { ChatMessageRecord, Json, RagTraceRecord } from '@/lib/types/database';

interface CacheEntry {
  answer: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_SIZE = 200;
const HISTORY_MESSAGE_LIMIT = 20;
const answerCache = new Map<string, CacheEntry>();

function getCached(key: string): string | null {
  const entry = answerCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    answerCache.delete(key);
    return null;
  }
  return entry.answer;
}

function setCached(key: string, answer: string): void {
  if (answerCache.size >= CACHE_MAX_SIZE) {
    const firstKey = answerCache.keys().next().value;
    if (firstKey !== undefined) answerCache.delete(firstKey);
  }
  answerCache.set(key, { answer, expiresAt: Date.now() + CACHE_TTL_MS });
}

const NO_MATCH_THRESHOLD = 0.2;
const HALLUCINATION_THRESHOLD = 0.35;
const NOT_FOUND_MSG =
  'I could not find enough information in the KT documents to answer this question. ' +
  'This may indicate a gap in the knowledge base — consider asking your admin to add relevant documentation.';

type ResponseStyle = 'default' | 'concise' | 'step_by_step' | 'bullet_list';
let hasEnsuredChatSessionTitleSchema = false;

async function ensureChatSessionTitleSchema() {
  if (hasEnsuredChatSessionTitleSchema) return;

  try {
    await sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title text`;
    hasEnsuredChatSessionTitleSchema = true;
  } catch {
    // Keep chat functional even if schema check fails temporarily.
  }
}

function buildMemoryAwarePrompt(projectName: string, context: string, hasDocumentContext: boolean) {
  if (hasDocumentContext) {
    return buildKtPrompt(projectName, context);
  }

  return [
    `You are a helpful KT (Knowledge Transfer) assistant for the ${projectName} transition.`,
    'No matching KT document context was retrieved for this request.',
    'You may still answer using relevant persisted user memory if it is directly applicable to the question.',
    'If the answer is not supported by user memory either, say that clearly.',
    'Do not invent document citations when no document context is present.',
  ].join('\n');
}

async function ensureSessionForUser(
  userId: string,
  projectId: string,
  existingSessionId?: string | null,
): Promise<{ sessionId: string | null; wasCreated: boolean }> {
  if (existingSessionId) {
    const rows = await sql`
      select id
      from chat_sessions
      where id = ${existingSessionId} and user_id = ${userId} and project_id = ${projectId}
      limit 1
    `;

    if (rows.length) {
      return { sessionId: existingSessionId, wasCreated: false };
    }
  }

  const createdRows = await sql`
    insert into chat_sessions (user_id, project_id, message_count)
    values (${userId}, ${projectId}, 0)
    returning id
  `;

  return {
    sessionId: (createdRows[0]?.id as string) ?? null,
    wasCreated: true,
  };
}

function deriveSessionTitle(message: string): string | null {
  const normalized = message.trim().replace(/\s+/g, ' ');

  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  const nonTitlePhrases = ['yes remember', 'no remember', 'remember yes', 'remember no'];
  if (nonTitlePhrases.includes(lower)) return null;

  if (lower.startsWith('remember ')) {
    return null;
  }

  return normalized.slice(0, 72);
}

function buildResponsePreferenceInstruction(
  responseStyle: ResponseStyle,
  citationsOnly: boolean,
): string {
  const instructions: string[] = [];

  if (responseStyle === 'concise') {
    instructions.push('Keep responses concise and focused.');
  } else if (responseStyle === 'step_by_step') {
    instructions.push('Respond in clear step-by-step format.');
  } else if (responseStyle === 'bullet_list') {
    instructions.push('Respond primarily as short bullet points.');
  }

  if (citationsOnly) {
    instructions.push(
      'Only include claims that are supported by retrieved source context or relevant user memory. If unsure, say so clearly.',
    );
  }

  return instructions.join(' ');
}

function buildClarifyingQuestionInstruction(clarifyFirst: boolean): string {
  if (!clarifyFirst) {
    return '';
  }

  return [
    'Clarify-first mode is enabled.',
    'If the user request is broad, ambiguous, or missing a key detail needed for a high-quality answer, ask exactly one short clarifying question first and stop there.',
    'If the request is already specific enough, answer directly.',
    'Do not ask multiple questions at once.',
  ].join(' ');
}

function buildStructuredOutputInstruction(message: string): string {
  const lower = message.toLowerCase();
  const instructions = [
    'When a structured format would improve clarity, format the answer in markdown using short headings and compact sections.',
    'Prefer clear markdown structures such as checklists, tables, numbered timelines, risk matrices, and dependency maps when appropriate to the question.',
  ];

  if (/(risk|dependency|dependencies)/.test(lower)) {
    instructions.push(
      'For risk or dependency questions, prefer a markdown table or a section titled "## Risk Matrix" or "## Dependency Map" if that best fits the answer.',
    );
  }

  if (/(timeline|plan|roadmap|sequence|week|onboarding|steps)/.test(lower)) {
    instructions.push(
      'For plans or sequences, prefer a numbered timeline or a section titled "## Timeline" or "## Checklist".',
    );
  }

  return instructions.join(' ');
}

async function appendChatTurn(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  sources: Json = [],
) {
  await sql`
    insert into chat_messages (session_id, role, content, sources)
    values (${sessionId}, 'user', ${userMessage}, ${null})
  `;

  await sql`
    insert into chat_messages (session_id, role, content, sources)
    values (${sessionId}, 'assistant', ${assistantMessage}, ${sql.json(sources)})
  `;

  const countRows =
    await sql`select count(*) as c from chat_messages where session_id = ${sessionId}`;
  const count = Number(countRows[0]?.c ?? 0);

  await sql`
    update chat_sessions
    set message_count = ${count}, last_message_at = ${new Date().toISOString()}
    where id = ${sessionId}
  `;
}

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

  const messages = await sql<ChatMessageRecord[]>`
    SELECT * FROM chat_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
  `;

  // Normalize sources: postgres.js may return JSONB as a string if it was stored via JSON.stringify()
  const normalizedMessages = messages.map((m) => {
    let sources = m.sources;
    if (typeof sources === 'string') {
      try {
        sources = JSON.parse(sources);
      } catch {
        sources = null;
      }
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
      responseStyle?: ResponseStyle;
      citationsOnly?: boolean;
      clarifyFirst?: boolean;
    };

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureChatSessionTitleSchema();

    // Rate limit: 10 messages per 5 minutes (burst) and 30 per hour (sustained)
    const burstCheck = await checkRateLimit(userId, 'chatbot_message', 10, 300);
    if (!burstCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many messages in a short period. Please wait a moment before continuing.' },
        { status: 429 },
      );
    }
    const rateCheck = await checkRateLimit(userId, 'chatbot_message', 30, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Hourly message limit reached. Please try again later.' },
        { status: 429 },
      );
    }

    const canAccess = await userHasProjectAccess(userId, profile?.role, body.projectId);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureUserMemorySchema();

    const normalizedMessage = body.message.trim();
    const { sessionId: memorySessionId, wasCreated } = await ensureSessionForUser(
      userId,
      body.projectId,
      body.sessionId ?? null,
    );

    if (!memorySessionId) {
      return NextResponse.json({ error: 'Unable to initialize chat session' }, { status: 500 });
    }

    if (wasCreated) {
      const derivedTitle = deriveSessionTitle(normalizedMessage);
      if (derivedTitle) {
        await sql`
          UPDATE chat_sessions
          SET title = ${derivedTitle}
          WHERE id = ${memorySessionId} AND user_id = ${userId} AND title IS NULL
        `;
      }
    }

    const rememberIntent = parseRememberIntent(normalizedMessage);
    if (rememberIntent) {
      if (rememberIntent.isSensitive && !rememberIntent.allowsSensitiveStorage) {
        const sensitiveMessage =
          'That looks like sensitive data. I will not store it automatically. ' +
          'If you still want to save it, repeat your request and include "allow sensitive memory", then confirm with "yes remember".';

        await appendChatTurn(memorySessionId, body.message, sensitiveMessage, []);

        return new NextResponse(sensitiveMessage, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'x-session-id': memorySessionId,
            'x-sources': JSON.stringify([]),
          },
        });
      }

      await createPendingMemoryConfirmation(
        userId,
        memorySessionId,
        body.projectId,
        rememberIntent,
      );

      const confirmationPrompt =
        `I can remember this preference:\n` +
        `- ${rememberIntent.key}: ${rememberIntent.value}\n\n` +
        `Reply with \"yes remember\" to save it or \"no remember\" to cancel.`;

      await appendChatTurn(memorySessionId, body.message, confirmationPrompt, []);

      return new NextResponse(confirmationPrompt, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-session-id': memorySessionId,
          'x-sources': JSON.stringify([]),
        },
      });
    }

    const confirmationIntent = parseMemoryConfirmation(normalizedMessage);
    if (confirmationIntent) {
      const pending = await getPendingMemoryConfirmation(userId, memorySessionId);

      if (!pending) {
        const noPendingMessage =
          'No pending memory request found. Say "remember ..." first, then confirm with "yes remember".';

        await appendChatTurn(memorySessionId, body.message, noPendingMessage, []);

        return new NextResponse(noPendingMessage, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'x-session-id': memorySessionId,
            'x-sources': JSON.stringify([]),
          },
        });
      }

      if (confirmationIntent === 'cancel') {
        await clearPendingMemoryConfirmation(userId, memorySessionId);
        const cancelMessage = 'Memory update cancelled.';
        await appendChatTurn(memorySessionId, body.message, cancelMessage, []);

        return new NextResponse(cancelMessage, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'x-session-id': memorySessionId,
            'x-sources': JSON.stringify([]),
          },
        });
      }

      if (pending.is_sensitive && !pending.allows_sensitive_storage) {
        await clearPendingMemoryConfirmation(userId, memorySessionId);
        const blockedMessage =
          'I cannot save that memory because it contains sensitive content without explicit permission.';

        await appendChatTurn(memorySessionId, body.message, blockedMessage, []);

        return new NextResponse(blockedMessage, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'x-session-id': memorySessionId,
            'x-sources': JSON.stringify([]),
          },
        });
      }

      await upsertUserMemory({
        userId,
        projectId: pending.project_id,
        memoryKey: pending.memory_key,
        memoryValue: pending.memory_value,
        tags: pending.tags,
        confidence: 0.9,
        source: 'explicit',
      });
      await clearPendingMemoryConfirmation(userId, memorySessionId);

      const savedMessage = `Saved memory: ${pending.memory_key}. I will use it when relevant in future chats.`;
      await appendChatTurn(memorySessionId, body.message, savedMessage, []);

      return new NextResponse(savedMessage, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-session-id': memorySessionId,
          'x-sources': JSON.stringify([]),
        },
      });
    }

    const project = await getProjectById(body.projectId);
    const candidateMemories = await listUserMemories(userId, {
      projectId: body.projectId,
      limit: 80,
    });
    const relevantMemories = selectRelevantMemories(candidateMemories, body.message, 5);
    const chunks = await retrieveRelevantChunks(body.projectId, body.message);
    const t1 = Date.now();
    const retrieval_ms = t1 - t0;

    // Confidence gate — if no chunk clears the minimum threshold, return a hard
    // "not found" response without calling the LLM, and log a knowledge gap.
    const maxSimilarity = chunks.length > 0 ? Math.max(...chunks.map((c) => c.similarity)) : 0;
    const avgSimilarity =
      chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length : 0;

    const hasRelevantMemory = relevantMemories.length > 0;

    if ((chunks.length === 0 || maxSimilarity < NO_MATCH_THRESHOLD) && !hasRelevantMemory) {
      const gapSessionId = memorySessionId;

      await appendChatTurn(gapSessionId, body.message, NOT_FOUND_MSG, []);

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
    const responseStyle = body.responseStyle ?? 'default';
    const citationsOnly = body.citationsOnly ?? false;
    const clarifyFirst = body.clarifyFirst ?? false;
    const responsePreferenceInstruction = buildResponsePreferenceInstruction(
      responseStyle,
      citationsOnly,
    );
    const clarifyingQuestionInstruction = buildClarifyingQuestionInstruction(clarifyFirst);
    const structuredOutputInstruction = buildStructuredOutputInstruction(body.message);

    const cacheKey = `${body.projectId}:${body.message.trim().toLowerCase()}:${responseStyle}:${citationsOnly ? 'citations' : 'normal'}:${clarifyFirst ? 'clarify' : 'direct'}`;

    const sessionId = memorySessionId;

    const priorMessages = await sql<Pick<ChatMessageRecord, 'role' | 'content'>[]>`
      SELECT role, content
      FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT ${HISTORY_MESSAGE_LIMIT}
    `;

    const conversationHistory = priorMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await sql`
      INSERT INTO chat_messages (session_id, role, content, sources)
      VALUES (${sessionId}, 'user', ${body.message}, ${null})
    `;

    const cachedAnswer = conversationHistory.length === 0 ? getCached(cacheKey) : null;
    if (cachedAnswer !== null) {
      await sql`
        INSERT INTO chat_messages (session_id, role, content, sources)
        VALUES (${sessionId}, 'assistant', ${cachedAnswer}, ${sql.json(sources)})
      `;

      const countRows =
        await sql`SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ${sessionId}`;
      const count = Number(countRows[0]?.c ?? 0);

      await sql`
        UPDATE chat_sessions
        SET message_count = ${count}, last_message_at = ${new Date().toISOString()}
        WHERE id = ${sessionId}
      `;

      await logActivity({
        userId,
        projectId: body.projectId,
        action: 'chatbot_message',
        metadata: { cached: true },
      });

      if (maxSimilarity < HALLUCINATION_THRESHOLD) {
        await logActivity({
          userId,
          projectId: body.projectId,
          action: 'knowledge_gap',
          metadata: {
            query: body.message,
            maxSimilarity,
            reason: 'low_confidence_match',
          },
        });
      }

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

    if (relevantMemories.length > 0) {
      await touchUserMemories(relevantMemories.map((memory) => memory.id));
    }

    const memoryContext = buildMemoryContext(relevantMemories);
    const basePrompt = buildMemoryAwarePrompt(
      project?.name ?? body.projectName ?? 'Project',
      context,
      chunks.length > 0 && maxSimilarity >= NO_MATCH_THRESHOLD,
    );
    const systemPrompt = [
      basePrompt,
      memoryContext,
      responsePreferenceInstruction,
      clarifyingQuestionInstruction,
      structuredOutputInstruction,
    ]
      .filter((part) => part && part.trim().length > 0)
      .join('\n\n');

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (text: string) => controller.enqueue(new TextEncoder().encode(text));
        const enqueueStatus = (message: string) => enqueue(`\x00${message}\x00`);
        const tGenStart = Date.now();

        let generated = '';
        let usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        } | null = null;
        let modelUsed: string | null = null;
        const providerName = await getCurrentLlmProvider();

        try {
          // For Groq, use streaming; for Copilot, buffer the full response
          if (providerName === 'Groq') {
            // stream_options is a valid Groq API field not yet typed in groq-sdk;
            // Object.assign avoids the excess-property check.
            const groqArgs = Object.assign(
              {
                stream: true as const,
                max_tokens: 1024,
                messages: [
                  { role: 'system' as const, content: systemPrompt },
                  ...conversationHistory,
                  { role: 'user' as const, content: body.message },
                ],
              },
              { stream_options: { include_usage: true } },
            );
            const completion = await createGroqChatCompletion(groqArgs, (statusMessage) =>
              enqueueStatus(statusMessage),
            );

            const {
              text,
              usage: streamUsage,
              modelUsed: model,
            } = await streamGroqText(completion, (token) => {
              generated += token;
              enqueue(token);
            });

            generated = text;
            usage = streamUsage;
            modelUsed = model;
          } else {
            // Copilot proxy — non-streaming
            const result = await createChatCompletion(
              {
                max_tokens: 1024,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...conversationHistory,
                  { role: 'user', content: body.message },
                ],
              },
              (statusMessage) => enqueueStatus(statusMessage),
            );

            generated = result.choices[0]?.message.content ?? '';
            usage = result.usage ?? null;
            modelUsed = providerName;

            if (!generated.trim()) {
              generated =
                'I could not generate a response for that request. Please try rephrasing your question.';
            }

            // Stream the response character by character for consistency
            for (const char of generated) {
              enqueue(char);
            }
          }
        } catch (err) {
          enqueueStatus(
            `Failed to reach the AI. Please try again.${err instanceof Error ? ` (${err.message})` : ''}`,
          );
          controller.close();
          return;
        }

        const generation_ms = Date.now() - tGenStart;

        if (conversationHistory.length === 0) {
          setCached(cacheKey, generated);
        }

        const assistantMsgRows = await sql`
          INSERT INTO chat_messages (session_id, role, content, sources)
          VALUES (${sessionId}, 'assistant', ${generated}, ${sql.json(sources)})
          RETURNING id
        `;
        const assistantMsgId = (assistantMsgRows[0]?.id as string) ?? null;

        const countRows =
          await sql`SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ${sessionId}`;
        const count = Number(countRows[0]?.c ?? 0);

        await sql`
          UPDATE chat_sessions
          SET message_count = ${count}, last_message_at = ${new Date().toISOString()}
          WHERE id = ${sessionId}
        `;

        await logActivity({
          userId,
          projectId: body.projectId,
          action: 'chatbot_message',
          metadata: { cached: false },
        });

        if (maxSimilarity < HALLUCINATION_THRESHOLD) {
          await logActivity({
            userId,
            projectId: body.projectId,
            action: 'knowledge_gap',
            metadata: {
              query: body.message,
              maxSimilarity,
              reason: 'low_confidence_match',
            },
          });
        }

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
    await logApplicationError({
      source: 'api',
      category: 'chat.post',
      message: error instanceof Error ? error.message : 'Chat failed',
      stack: error instanceof Error ? (error.stack ?? null) : null,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 },
    );
  }
}
