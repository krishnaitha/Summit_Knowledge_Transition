import { revalidatePath } from 'next/cache';

import sql from '@/lib/db';
import { appEnv } from '@/lib/env';
import { createChatCompletion } from '@/lib/llm';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';

export const BOT_NO_MATCH_MSG =
  "I searched the project's KT documents but couldn't find enough information to answer this question. " +
  'Consider asking an admin to add relevant documentation.';

function buildBotReplyPrompt(projectName: string, context: string): string {
  return [
    `You are ${appEnv.botName}, a knowledge assistant for the ${projectName} knowledge transfer.`,
    'Answer the question using ONLY the context provided below.',
    '',
    'Formatting rules — follow strictly:',
    '- Use **bold** for key terms and step names',
    '- Use numbered lists (1. 2. 3.) for sequential steps',
    '- Use bullet points (-) for non-ordered items',
    '- Be concise and direct',
    '- Do NOT mention document filenames or source names in your answer — they are shown separately',
    '',
    'If the context does not contain enough information, say so clearly.',
    '',
    'Context:',
    context,
  ].join('\n');
}

export interface BotReplyParams {
  threadId: string;
  projectId: string;
  documentId: string;
  query: string;
}

export async function processBotThreadReply(
  params: BotReplyParams,
): Promise<{ threadId: string; chunkCount: number }> {
  const { threadId, projectId, documentId, query } = params;

  if (!threadId || !projectId || !query) {
    throw new Error('bot_thread_reply missing required fields');
  }

  const projects = await sql<{ name: string }[]>`
    SELECT name FROM projects WHERE id = ${projectId} LIMIT 1
  `;
  const projectName = projects[0]?.name ?? 'Project';

  const chunks = await retrieveRelevantChunks(projectId, query, 5);

  let answer: string;
  let sources: Array<{ document_name: string }> = [];

  if (!chunks.length || chunks[0].similarity < 0.2) {
    answer = BOT_NO_MATCH_MSG;
  } else {
    const uniqueDocNames = [...new Set(chunks.map((c) => c.document_name))];
    sources = uniqueDocNames.map((name) => ({ document_name: name }));

    const context = chunks.map((c) => c.content).join('\n\n---\n\n');
    const systemPrompt = buildBotReplyPrompt(projectName, context);

    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    answer = completion.choices[0]?.message.content?.trim() ?? BOT_NO_MATCH_MSG;
  }

  const sourcesJson = sources as unknown as Parameters<typeof sql.json>[0];

  await sql`
    INSERT INTO document_thread_comments (thread_id, author_id, body, is_answer, is_bot, sources)
    VALUES (${threadId}, NULL, ${answer}, true, true, ${sql.json(sourcesJson)})
  `;

  await sql`
    UPDATE document_threads SET updated_at = now() WHERE id = ${threadId}
  `;

  if (documentId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/documents/${documentId}/threads`);
  }

  return { threadId, chunkCount: chunks.length };
}
