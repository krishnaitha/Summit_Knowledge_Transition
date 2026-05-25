import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import sql from '@/lib/db';
import type { ChatMessageRecord } from '@/lib/types/database';

let hasEnsuredChatSessionTitleSchema = false;

async function ensureChatSessionTitleSchema() {
  if (hasEnsuredChatSessionTitleSchema) return;

  try {
    await sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title text`;
    hasEnsuredChatSessionTitleSchema = true;
  } catch {
    // Non-fatal: export route will return its normal error if DB is unavailable.
  }
}

function toSafeFilePart(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSources(sources: ChatMessageRecord['sources']) {
  return Array.isArray(sources) ? sources : [];
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function buildMarkdownExport(params: {
  projectName: string;
  sessionTitle: string;
  messages: ChatMessageRecord[];
}): string {
  const lines: string[] = [];

  lines.push(`# Chat Export: ${params.sessionTitle}`);
  lines.push('');
  lines.push(`- Project: ${params.projectName}`);
  lines.push(`- Exported At: ${new Date().toISOString()}`);
  lines.push('');

  for (const message of params.messages) {
    const roleLabel = message.role === 'assistant' ? 'Assistant' : 'User';
    lines.push(`## ${roleLabel} (${formatTimestamp(message.created_at)})`);
    lines.push('');
    lines.push(message.content);
    lines.push('');

    const sources = normalizeSources(message.sources);
    if (sources.length > 0) {
      lines.push('Sources:');
      for (const source of sources) {
        const confidence =
          typeof source.similarity === 'number'
            ? ` (similarity ${(source.similarity * 100).toFixed(1)}%)`
            : '';
        lines.push(`- ${source.documentName}${confidence}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildPrintableHtml(params: {
  projectName: string;
  sessionTitle: string;
  messages: ChatMessageRecord[];
}): string {
  const messageHtml = params.messages
    .map((message) => {
      const roleLabel = message.role === 'assistant' ? 'Assistant' : 'User';
      const sources = normalizeSources(message.sources);
      const sourcesHtml =
        sources.length > 0
          ? `<div class="sources"><strong>Sources:</strong><ul>${sources
              .map((source) => {
                const confidence =
                  typeof source.similarity === 'number'
                    ? ` <span class="confidence">(similarity ${(source.similarity * 100).toFixed(1)}%)</span>`
                    : '';
                return `<li>${escapeHtml(source.documentName)}${confidence}</li>`;
              })
              .join('')}</ul></div>`
          : '';

      return `<section class="message">
        <h3>${roleLabel} <span class="time">${escapeHtml(formatTimestamp(message.created_at))}</span></h3>
        <pre>${escapeHtml(message.content)}</pre>
        ${sourcesHtml}
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(params.sessionTitle)} - Chat Export</title>
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #0f172a; }
      h1 { margin-bottom: 0.25rem; }
      .meta { color: #475569; margin-bottom: 1rem; }
      .message { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
      .message h3 { margin: 0 0 8px; font-size: 14px; }
      .time { color: #64748b; font-weight: 400; font-size: 12px; }
      pre { white-space: pre-wrap; word-break: break-word; margin: 0; font-size: 13px; line-height: 1.5; }
      .sources { margin-top: 10px; font-size: 12px; color: #334155; }
      .sources ul { margin: 6px 0 0 18px; padding: 0; }
      .confidence { color: #64748b; }
      @media print {
        body { margin: 12mm; }
        .message { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(params.sessionTitle)}</h1>
    <p class="meta">Project: ${escapeHtml(params.projectName)} | Exported At: ${escapeHtml(new Date().toISOString())}</p>
    ${messageHtml}
    <script>window.addEventListener('load', () => window.print());</script>
  </body>
</html>`;
}

export async function GET(request: Request) {
  try {
    await ensureChatSessionTitleSchema();

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const format = (searchParams.get('format') ?? 'markdown').toLowerCase();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const { userId } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionRows = await sql<
      Array<{ id: string; title: string | null; project_name: string }>
    >`
      SELECT cs.id, cs.title, p.name as project_name
      FROM chat_sessions cs
      JOIN projects p ON p.id = cs.project_id
      WHERE cs.id = ${sessionId} AND cs.user_id = ${userId}
      LIMIT 1
    `;

    if (!sessionRows.length) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messageRows = await sql<ChatMessageRecord[]>`
      SELECT * FROM chat_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
    `;

    const normalizedMessages = messageRows.map((message) => {
      let sources = message.sources;
      if (typeof sources === 'string') {
        try {
          sources = JSON.parse(sources) as ChatMessageRecord['sources'];
        } catch {
          sources = null;
        }
      }
      return { ...message, sources: normalizeSources(sources) };
    });

    const session = sessionRows[0];
    const sessionTitle = session.title?.trim() || 'Chat Session';
    const fileBase = `${toSafeFilePart(session.project_name || 'project')}-${toSafeFilePart(sessionTitle || 'chat') || 'chat'}`;

    if (format === 'pdf') {
      const html = buildPrintableHtml({
        projectName: session.project_name,
        sessionTitle,
        messages: normalizedMessages,
      });

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${fileBase}.html"`,
        },
      });
    }

    const markdown = buildMarkdownExport({
      projectName: session.project_name,
      sessionTitle,
      messages: normalizedMessages,
    });

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.md"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export chat' },
      { status: 500 },
    );
  }
}
