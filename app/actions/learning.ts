'use server';

import { revalidatePath } from 'next/cache';

import { requireMember } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { createQuizCompletion } from '@/lib/llm';
import type { Json } from '@/lib/types/database';

function clean(value: FormDataEntryValue | null, max = 5000): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function parseFlashcardsFromModel(raw: string) {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    const list = (Array.isArray(parsed) ? parsed : (parsed.flashcards ?? [])) as Array<
      Record<string, unknown>
    >;

    return list
      .map((item) => ({
        chunkId: String(item.chunkId ?? '').trim(),
        question: String(item.question ?? '').trim(),
        answer: String(item.answer ?? '').trim(),
        difficulty: String(item.difficulty ?? 'medium').toLowerCase(),
      }))
      .filter((item) => item.chunkId && item.question && item.answer)
      .map((item) => ({
        ...item,
        difficulty:
          item.difficulty === 'easy' || item.difficulty === 'hard' || item.difficulty === 'medium'
            ? item.difficulty
            : 'medium',
      }));
  } catch {
    return [] as Array<{ chunkId: string; question: string; answer: string; difficulty: string }>;
  }
}

export async function generateProjectFlashcardsAction(formData: FormData) {
  const { profile } = await requireMember();

  const projectId = clean(formData.get('project_id'), 64);
  const countRaw = Number(clean(formData.get('count'), 8));
  const count = Math.min(Math.max(Number.isFinite(countRaw) ? countRaw : 20, 5), 40);

  if (!projectId) {
    return;
  }

  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, projectId);
  if (!canAccess) {
    return;
  }

  const chunks = await sql<
    { chunk_id: string; content: string; chunk_index: number; document_name: string }[]
  >`
    SELECT
      dc.id AS chunk_id,
      dc.content,
      dc.chunk_index,
      d.file_name AS document_name
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.project_id = ${projectId}
    ORDER BY random()
    LIMIT ${Math.max(count * 2, 20)}
  `;

  if (!chunks.length) {
    return;
  }

  const context = chunks.slice(0, Math.max(count, 10)).map((chunk) => ({
    chunkId: chunk.chunk_id,
    doc: chunk.document_name,
    chunkIndex: chunk.chunk_index,
    excerpt: chunk.content.slice(0, 500),
  }));

  const completion = await createQuizCompletion({
    messages: [
      {
        role: 'system',
        content:
          'Generate concise study flashcards from provided knowledge chunks. Return only JSON with key flashcards (array). Each item: chunkId, question, answer, difficulty (easy|medium|hard).',
      },
      {
        role: 'user',
        content: `Create ${count} flashcards from these chunks. Keep questions practical and answers under 60 words.\n${JSON.stringify(context)}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 2200,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content ?? '{}';
  const parsed = parseFlashcardsFromModel(raw);

  const fallback = context.slice(0, count).map((item) => ({
    chunkId: item.chunkId,
    question: `What is a key takeaway from ${item.doc} (chunk ${item.chunkIndex + 1})?`,
    answer: item.excerpt.slice(0, 220),
    difficulty: 'medium',
  }));

  const cards = (parsed.length ? parsed : fallback).slice(0, count);

  for (const card of cards) {
    await sql`
      INSERT INTO flashcards (project_id, source_chunk_id, question, answer, difficulty, created_by)
      VALUES (
        ${projectId},
        ${card.chunkId},
        ${card.question.slice(0, 500)},
        ${card.answer.slice(0, 3000)},
        ${card.difficulty},
        ${profile!.id}
      )
    `;
  }

  await sql`
    INSERT INTO activity_log (user_id, project_id, action, metadata)
    VALUES (${profile!.id}, ${projectId}, 'flashcards_generated', ${sql.json({ count: cards.length } as Json)})
  `;

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/flashcards`);
}

export async function reviewFlashcardAction(formData: FormData) {
  const { profile } = await requireMember();

  const projectId = clean(formData.get('project_id'), 64);
  const flashcardId = clean(formData.get('flashcard_id'), 64);
  const rating = clean(formData.get('rating'), 16).toLowerCase();

  if (!projectId || !flashcardId) {
    return;
  }

  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, projectId);
  if (!canAccess) {
    return;
  }

  const rows = await sql<{ id: string }[]>`
    SELECT id FROM flashcards
    WHERE id = ${flashcardId} AND project_id = ${projectId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return;
  }

  const quality = rating === 'again' ? 1 : rating === 'hard' ? 3 : rating === 'easy' ? 5 : 4;

  const progressRows = await sql<
    { interval_days: number; ease_factor: number; repetitions: number }[]
  >`
    SELECT interval_days, ease_factor, repetitions
    FROM flashcard_progress
    WHERE user_id = ${profile!.id} AND flashcard_id = ${flashcardId}
    LIMIT 1
  `;

  const current = progressRows[0] ?? { interval_days: 1, ease_factor: 2.5, repetitions: 0 };

  let repetitions = current.repetitions;
  let intervalDays = current.interval_days;
  let easeFactor = Number(current.ease_factor ?? 2.5);

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  await sql`
    INSERT INTO flashcard_progress (
      user_id, flashcard_id, interval_days, ease_factor, repetitions, due_at, last_reviewed_at, updated_at
    )
    VALUES (
      ${profile!.id},
      ${flashcardId},
      ${intervalDays},
      ${Number(easeFactor.toFixed(2))},
      ${repetitions},
      now() + (${intervalDays} * interval '1 day'),
      now(),
      now()
    )
    ON CONFLICT (user_id, flashcard_id)
    DO UPDATE SET
      interval_days = EXCLUDED.interval_days,
      ease_factor = EXCLUDED.ease_factor,
      repetitions = EXCLUDED.repetitions,
      due_at = EXCLUDED.due_at,
      last_reviewed_at = EXCLUDED.last_reviewed_at,
      updated_at = now()
  `;

  revalidatePath(`/projects/${projectId}/flashcards`);
}
