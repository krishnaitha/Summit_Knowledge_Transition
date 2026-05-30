'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUserContext, getProjectAdminIds } from '@/lib/auth';
import { ensureDismissedGapsSchema, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

async function canModerateProject(projectId: string) {
  const { userId, profile } = await getCurrentUserContext();

  if (!userId || !profile) {
    return { allowed: false as const, userId: null };
  }

  if (profile.role === 'admin') {
    return { allowed: true as const, userId };
  }

  const adminProjectIds = await getProjectAdminIds(userId);
  return { allowed: adminProjectIds.includes(projectId), userId } as const;
}

function revalidateKnowledgeGapThreadPaths(projectId: string, threadId: string) {
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/knowledge-gap-threads/${threadId}`);
  revalidatePath('/admin/threads');
}

function revalidateThreadPaths(projectId: string, documentId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents/${documentId}/threads`);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/documents`);
  revalidatePath(`/admin/projects/${projectId}/documents/${documentId}/threads`);
}

let knowledgeGapSchemaReady: Promise<void> | null = null;

async function ensureKnowledgeGapThreadSchema() {
  if (!knowledgeGapSchemaReady) {
    knowledgeGapSchemaReady = (async () => {
      await sql`
        ALTER TABLE document_threads
        ALTER COLUMN document_id DROP NOT NULL
      `;

      await sql`
        ALTER TABLE document_threads
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'document'
      `;

      await sql`
        ALTER TABLE document_threads
        ADD COLUMN IF NOT EXISTS gap_query text
      `;

      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'document_threads_source_check'
          ) THEN
            ALTER TABLE document_threads
            ADD CONSTRAINT document_threads_source_check
            CHECK (source IN ('document', 'knowledge_gap'));
          END IF;
        END $$
      `;
    })().catch((error: unknown) => {
      knowledgeGapSchemaReady = null;
      throw error;
    });
  }

  await knowledgeGapSchemaReady;
}

export async function createKnowledgeGapThreadAction(formData: FormData) {
  const projectId = cleanText(formData.get('project_id'), 64);
  const gapQuery = cleanText(formData.get('gap_query'), 500);

  if (!projectId || !gapQuery) return;

  const moderation = await canModerateProject(projectId);
  if (!moderation.allowed || !moderation.userId) return;

  const title = gapQuery.length > 155 ? `${gapQuery.slice(0, 155)}…` : gapQuery;

  await ensureKnowledgeGapThreadSchema();

  await sql`
    INSERT INTO document_threads (project_id, document_id, created_by, title, source, gap_query)
    VALUES (${projectId}, NULL, ${moderation.userId}, ${title}, 'knowledge_gap', ${gapQuery})
  `;

  revalidatePath('/admin/dashboard');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/admin/threads');
}

export async function createDocumentThreadAction(formData: FormData) {
  const projectId = cleanText(formData.get('project_id'), 64);
  const documentId = cleanText(formData.get('document_id'), 64);
  const title = cleanText(formData.get('title'), 160);
  const body = cleanText(formData.get('body'), 5000);
  const pageRaw = cleanText(formData.get('page_number'), 32);

  if (!projectId || !documentId || !title || !body) {
    return;
  }

  const { userId, profile } = await getCurrentUserContext();
  if (!userId) {
    return;
  }

  const canAccess = await userHasProjectAccess(userId, profile?.role, projectId);
  if (!canAccess) {
    return;
  }

  const pageNumber = pageRaw ? Number(pageRaw) : null;
  const safePageNumber =
    Number.isFinite(pageNumber) && (pageNumber as number) > 0
      ? Math.floor(pageNumber as number)
      : null;

  const rows = await sql<{ id: string }[]>`
    INSERT INTO document_threads (project_id, document_id, created_by, title, page_number)
    VALUES (${projectId}, ${documentId}, ${userId}, ${title}, ${safePageNumber})
    RETURNING id
  `;
  const threadId = rows[0]?.id;

  if (!threadId) {
    return;
  }

  await sql`
    INSERT INTO document_thread_comments (thread_id, author_id, body, is_answer)
    VALUES (${threadId}, ${userId}, ${body}, false)
  `;

  // Enqueue bot reply — worker will retrieve relevant chunks and post an AI answer
  const query = `${title} ${body}`.slice(0, 1000);
  await sql`
    INSERT INTO processing_jobs (type, payload)
    VALUES ('bot_thread_reply', ${sql.json({ threadId, projectId, documentId, query })})
  `;

  revalidateThreadPaths(projectId, documentId);
}

export async function addDocumentThreadReplyAction(formData: FormData) {
  const projectId = cleanText(formData.get('project_id'), 64);
  const documentId = cleanText(formData.get('document_id'), 64);
  const threadId = cleanText(formData.get('thread_id'), 64);
  const body = cleanText(formData.get('body'), 5000);
  const markAsAnswer = String(formData.get('mark_as_answer') ?? 'false') === 'true';

  if (!projectId || !threadId || !body) {
    return;
  }

  const { userId, profile } = await getCurrentUserContext();
  if (!userId) {
    return;
  }

  const canAccess = await userHasProjectAccess(userId, profile?.role, projectId);
  if (!canAccess) {
    return;
  }

  const moderation = await canModerateProject(projectId);
  const isAnswer = markAsAnswer && moderation.allowed;

  await sql`
    INSERT INTO document_thread_comments (thread_id, author_id, body, is_answer)
    VALUES (${threadId}, ${userId}, ${body}, ${isAnswer})
  `;

  await sql`
    UPDATE document_threads
    SET updated_at = now()
    WHERE id = ${threadId}
  `;

  if (documentId) {
    revalidateThreadPaths(projectId, documentId);
  } else {
    revalidateKnowledgeGapThreadPaths(projectId, threadId);
  }
}

export async function updateDocumentThreadStatusAction(formData: FormData) {
  const projectId = cleanText(formData.get('project_id'), 64);
  const documentId = cleanText(formData.get('document_id'), 64);
  const threadId = cleanText(formData.get('thread_id'), 64);
  const nextStatus = cleanText(formData.get('next_status'), 16);

  if (!projectId || !threadId || !['open', 'resolved'].includes(nextStatus)) {
    return;
  }

  const moderation = await canModerateProject(projectId);
  if (!moderation.allowed || !moderation.userId) {
    return;
  }

  if (nextStatus === 'resolved') {
    await sql`
      UPDATE document_threads
      SET status = 'resolved', resolved_by = ${moderation.userId}, resolved_at = now(), updated_at = now()
      WHERE id = ${threadId}
    `;
  } else {
    await sql`
      UPDATE document_threads
      SET status = 'open', resolved_by = null, resolved_at = null, updated_at = now()
      WHERE id = ${threadId}
    `;
  }

  if (documentId) {
    revalidateThreadPaths(projectId, documentId);
  } else {
    revalidateKnowledgeGapThreadPaths(projectId, threadId);
  }
}

export async function dismissKnowledgeGapAction(formData: FormData) {
  const query = cleanText(formData.get('query'), 500);
  if (!query) return;

  const { userId, profile } = await getCurrentUserContext();
  if (!userId || profile?.role !== 'admin') return;

  await ensureDismissedGapsSchema();

  await sql`
    INSERT INTO dismissed_knowledge_gaps (norm_query, dismissed_by)
    VALUES (${query.toLowerCase().trim()}, ${userId})
    ON CONFLICT (norm_query) DO NOTHING
  `;

  revalidatePath('/admin/dashboard');
}
