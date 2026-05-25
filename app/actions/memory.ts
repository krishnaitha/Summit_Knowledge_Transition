'use server';

import { revalidatePath } from 'next/cache';

import { requireAuthenticatedUser } from '@/lib/auth';
import {
  deleteUserMemory,
  ensureUserMemorySchema,
  listUserMemories,
  upsertUserMemory,
} from '@/lib/memory-store';

function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

export async function saveUserMemoryAction(formData: FormData) {
  const { userId } = await requireAuthenticatedUser();
  if (!userId) return;

  const memoryKey = String(formData.get('memory_key') ?? '')
    .trim()
    .toLowerCase();
  const memoryValue = String(formData.get('memory_value') ?? '').trim();
  const tagsInput = String(formData.get('tags') ?? '').trim();
  const confidenceRaw = Number(formData.get('confidence') ?? 0.8);
  const projectId = String(formData.get('project_id') ?? '').trim();

  if (!memoryKey || !memoryValue) return;

  await ensureUserMemorySchema();

  await upsertUserMemory({
    userId,
    projectId: projectId || null,
    memoryKey,
    memoryValue,
    tags: parseTags(tagsInput),
    confidence: Number.isFinite(confidenceRaw) ? confidenceRaw : 0.8,
    source: 'manual',
  });

  revalidatePath('/memory');
}

export async function deleteUserMemoryAction(formData: FormData) {
  const { userId } = await requireAuthenticatedUser();
  if (!userId) return;
  const memoryId = String(formData.get('memory_id') ?? '').trim();

  if (!memoryId) return;

  await ensureUserMemorySchema();
  await deleteUserMemory(userId, memoryId);

  revalidatePath('/memory');
}

export async function getUserMemoriesForCurrentUser(projectId?: string) {
  const { userId } = await requireAuthenticatedUser();
  if (!userId) return [];
  await ensureUserMemorySchema();
  return listUserMemories(userId, { projectId, limit: 120 });
}
