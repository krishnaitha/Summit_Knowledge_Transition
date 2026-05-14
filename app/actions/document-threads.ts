'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUserContext, getProjectAdminIds } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
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

function revalidateThreadPaths(projectId: string, documentId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents/${documentId}/threads`);
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/documents`);
  revalidatePath(`/admin/projects/${projectId}/documents/${documentId}/threads`);
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

  revalidateThreadPaths(projectId, documentId);
}

export async function addDocumentThreadReplyAction(formData: FormData) {
  const projectId = cleanText(formData.get('project_id'), 64);
  const documentId = cleanText(formData.get('document_id'), 64);
  const threadId = cleanText(formData.get('thread_id'), 64);
  const body = cleanText(formData.get('body'), 5000);
  const markAsAnswer = String(formData.get('mark_as_answer') ?? 'false') === 'true';

  if (!projectId || !documentId || !threadId || !body) {
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

  revalidateThreadPaths(projectId, documentId);
}

export async function updateDocumentThreadStatusAction(formData: FormData) {
  const projectId = cleanText(formData.get('project_id'), 64);
  const documentId = cleanText(formData.get('document_id'), 64);
  const threadId = cleanText(formData.get('thread_id'), 64);
  const nextStatus = cleanText(formData.get('next_status'), 16);

  if (!projectId || !documentId || !threadId || !['open', 'resolved'].includes(nextStatus)) {
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

  revalidateThreadPaths(projectId, documentId);
}
