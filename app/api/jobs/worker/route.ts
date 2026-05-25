import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import sql from '@/lib/db';
import { processBotThreadReply } from '@/lib/documents/bot-reply';
import {
  enqueueDueDocumentConnectorSyncJobs,
  syncDocumentConnector,
} from '@/lib/documents/connectors';
import { extractTextFromFile } from '@/lib/documents/parse';
import { processDocumentRecord } from '@/lib/documents/process';
import { createQuizCompletion } from '@/lib/llm';
import { downloadFile } from '@/lib/storage/local';
import type { ProcessingJobRecord, QuizOptionKey } from '@/lib/types/database';
import { sleep } from '@/lib/utils';

const AUTO_SYNC_ENQUEUE_CHECK_MS = Math.max(
  60_000,
  Number(process.env.CONNECTOR_AUTO_SYNC_CHECK_MS ?? 15 * 60 * 1000),
);
const CONNECTOR_AUTO_SYNC_INTERVAL_HOURS = Math.max(
  1,
  Number(process.env.CONNECTOR_AUTO_SYNC_INTERVAL_HOURS ?? 24),
);

let nextAutoSyncCheckAt = 0;

// ─── Quiz generation helpers ────────────────────────────────────────────────────

type Category = 'functional' | 'technical';

interface RawQuestion {
  question_text: string;
  question_type: 'mcq' | 'true_false';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  marks: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitIntoGroups<T>(arr: T[], n: number): T[][] {
  const groups: T[][] = Array.from({ length: n }, () => []);
  arr.forEach((item, i) => groups[i % n].push(item));
  return groups;
}

function buildSystemPrompt(category: Category): string {
  if (category === 'functional') {
    return `You are a senior business analyst designing a knowledge-transfer readiness quiz.

Your questions must assess whether the reader can APPLY and ANALYSE knowledge — not just recall facts.
Every question should be scenario-based or decision-based:
- "A stakeholder requests X — what is the correct process / who must approve?"
- "An exception occurs in workflow Y — what is the escalation path?"
- "Team A hands off to Team B — what must be verified before sign-off?"
- "The business rule states Z — which of these situations violates it?"

Focus areas (pick the most relevant from the context provided):
business workflows · process ownership · approval chains · SLA / SLO obligations ·
cross-team handoffs · data ownership · exception handling · access controls ·
compliance requirements · end-user impact

Complexity rules:
- marks=2: application-level (reader must apply a rule to a scenario)
- marks=3: analysis-level (reader must compare trade-offs or diagnose a process failure)
- At least 40 % of questions must be marks=3
- Wrong options must be realistic — a reader who skimmed the docs would pick them

Question type rules:
- Most questions (≥70 %) should be "mcq" (4 options: option_a, option_b, option_c, option_d)
- Up to 30 % may be "true_false" — a statement the reader must judge as True or False
  - For true_false: option_a must be "True", option_b must be "False", leave option_c and option_d as ""
  - For true_false: correct_option is "A" (True) or "B" (False), marks is always 1

Return ONLY a JSON object. No markdown fences. No commentary outside the JSON.`;
  }

  return `You are a senior solutions architect designing a knowledge-transfer readiness quiz.

Your questions must assess whether the reader can APPLY and ANALYSE technical knowledge — not look up facts.
Every question should be scenario-based or diagnostic:
- "Component A receives request X — trace the data flow and identify the correct outcome"
- "Configuration parameter Y is changed — what breaks and why?"
- "A production alert fires for Z — what is the most likely root cause given the architecture?"
- "The engineer must integrate service A with service B — which approach is correct given the constraints?"

Focus areas (pick the most relevant from the context provided):
system architecture · data models & schemas · API contracts & payload shapes ·
authentication / authorisation mechanisms · deployment topology · integration patterns ·
caching strategies · failure modes & circuit breakers · observability & alerting ·
infrastructure configuration · database query behaviour · technical debt & known constraints

Complexity rules:
- marks=2: application-level (reader applies technical knowledge to a concrete scenario)
- marks=3: analysis-level (reader must diagnose, compare implementations, or reason about failure)
- At least 40 % of questions must be marks=3
- Wrong options must look correct to someone who only half-understands the system

Question type rules:
- Most questions (≥70 %) should be "mcq" (4 options: option_a, option_b, option_c, option_d)
- Up to 30 % may be "true_false" — a statement the reader must judge as True or False
  - For true_false: option_a must be "True", option_b must be "False", leave option_c and option_d as ""
  - For true_false: correct_option is "A" (True) or "B" (False), marks is always 1

Return ONLY a JSON object. No markdown fences. No commentary outside the JSON.`;
}

function buildUserPrompt(
  context: string,
  category: Category,
  setIndex: number,
  totalSets: number,
): string {
  const label = category === 'functional' ? 'Functional' : 'Technical';
  const topicHint =
    setIndex === 0
      ? 'Cover the foundational concepts introduced early in the documents.'
      : setIndex === totalSets - 1
        ? 'Cover advanced, edge-case, and exception-handling aspects from the documents.'
        : `Cover mid-level concepts from the documents. This is set ${setIndex + 1} of ${totalSets} — do NOT repeat topics or question patterns from the other sets.`;

  return `You are generating Set ${setIndex + 1} of ${totalSets} for a ${label} quiz.
${topicHint}

Generate exactly 10 ${label} questions using ONLY the excerpts below.
Mix question types: at least 7 MCQ and up to 3 true_false.
Vary the question style — mix scenario, diagnostic, and decision-based formats.
Do not ask trivial "what is the definition of X" questions.

Required JSON shape (return this and nothing else):
{
  "questions": [
    {
      "question_text": "...",
      "question_type": "mcq",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_option": "A" | "B" | "C" | "D",
      "explanation": "Why this answer is correct and why the others are wrong.",
      "marks": 2 or 3
    },
    {
      "question_text": "State whether the following is True or False: ...",
      "question_type": "true_false",
      "option_a": "True",
      "option_b": "False",
      "option_c": "",
      "option_d": "",
      "correct_option": "A" or "B",
      "explanation": "Why this is true/false.",
      "marks": 1
    }
  ]
}

KT Document Excerpts (Set ${setIndex + 1} source material):
${context}

Generate 10 questions now.`;
}

function parseQuestions(raw: string): RawQuestion[] {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const list: RawQuestion[] = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    return list
      .filter((q) => {
        if (!q.question_text || !q.option_a || !q.option_b) return false;
        const isTrueFalse = String(q.question_type ?? '').toLowerCase() === 'true_false';
        const correctUpper = String(q.correct_option ?? '').toUpperCase();
        if (isTrueFalse) return ['A', 'B'].includes(correctUpper);
        return q.option_c && q.option_d && ['A', 'B', 'C', 'D'].includes(correctUpper);
      })
      .map((q) => ({
        ...q,
        question_type:
          String(q.question_type ?? '').toLowerCase() === 'true_false' ? 'true_false' : 'mcq',
        correct_option: String(q.correct_option).toUpperCase(),
      }));
  } catch {
    return [];
  }
}

// ─── Job processors ──────────────────────────────────────────────────────────────

async function processDocumentJob(payload: Record<string, unknown>) {
  const documentId = String(payload.documentId ?? '');
  const projectId = String(payload.projectId ?? '');

  const docs = await sql`SELECT * FROM documents WHERE id = ${documentId} LIMIT 1`;
  const document = docs[0];
  if (!document) throw new Error('Document not found');

  // Download from local storage
  const buffer = await downloadFile(document.file_url as string);

  const content = await extractTextFromFile(document.file_name as string, buffer);
  const chunkCount = await processDocumentRecord(documentId, projectId, content);

  revalidatePath(`/admin/projects/${projectId}`);
  return { chunkCount };
}

async function processQuizGenerateJob(payload: Record<string, unknown>) {
  const projectId = String(payload.projectId ?? '');
  const category: Category = payload.category === 'technical' ? 'technical' : 'functional';
  const numSets = Math.min(5, Math.max(1, Number(payload.numSets) || 3));

  const rawChunks = await sql<{ content: string }[]>`
    SELECT content FROM document_chunks WHERE project_id = ${projectId} LIMIT 30
  `;

  if (!rawChunks.length) {
    throw new Error('No document content found. Upload and process KT documents first.');
  }

  const shuffled = shuffle(rawChunks);
  const chunkGroups = splitIntoGroups(shuffled, numSets);

  const existingSets = await sql`
    SELECT set_number FROM quiz_sets WHERE project_id = ${projectId} ORDER BY set_number DESC LIMIT 1
  `;
  const startSetNumber = Number(existingSets[0]?.set_number ?? 0) + 1;
  const categoryLabel = category === 'functional' ? 'Functional' : 'Technical';
  const systemPrompt = buildSystemPrompt(category);

  let createdSets = 0;
  let createdQuestions = 0;

  for (let i = 0; i < numSets; i++) {
    if (i > 0) await sleep(3000);

    const context = (chunkGroups[i] ?? chunkGroups[0])
      .map((c) => c.content.slice(0, 300).trim())
      .join('\n---\n');

    const userPrompt = buildUserPrompt(context, category, i, numSets);
    let questions: RawQuestion[] = [];

    try {
      const completion = await createQuizCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 2500,
      });

      const raw = completion?.choices?.[0]?.message?.content ?? '{}';
      questions = parseQuestions(raw);
    } catch (groqErr) {
      const msg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      console.error(`[worker] LLM error on set ${i + 1}:`, msg);
      if (i === 0) throw new Error(`AI generation failed: ${msg}`);
      continue;
    }

    if (!questions.length) continue;

    const setNumber = startSetNumber + i;
    const newSetRows = await sql`
      INSERT INTO quiz_sets (project_id, set_name, set_number, category, is_active)
      VALUES (${projectId}, ${`${categoryLabel} Set ${setNumber}`}, ${setNumber}, ${category}, false)
      RETURNING id
    `;
    const newSetId = newSetRows[0]?.id as string | undefined;
    if (!newSetId) continue;

    for (const q of questions) {
      await sql`
        INSERT INTO quiz_questions
          (quiz_set_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_option, explanation, marks)
        VALUES (
          ${newSetId}, ${q.question_text}, ${q.question_type},
          ${q.option_a}, ${q.option_b}, ${q.option_c ?? ''}, ${q.option_d ?? ''},
          ${q.correct_option as QuizOptionKey}, ${q.explanation || null},
          ${q.question_type === 'true_false' ? 1 : q.marks === 3 ? 3 : 2}
        )
      `;
    }

    createdSets++;
    createdQuestions += questions.length;
  }

  if (createdSets === 0) {
    throw new Error(
      'No sets were created. The AI may have returned unusable output — please try again.',
    );
  }

  revalidatePath(`/admin/projects/${projectId}/quiz`);
  return { createdSets, createdQuestions };
}

async function processBotThreadReplyJob(payload: Record<string, unknown>) {
  return processBotThreadReply({
    threadId: String(payload.threadId ?? ''),
    projectId: String(payload.projectId ?? ''),
    documentId: String(payload.documentId ?? ''),
    query: String(payload.query ?? ''),
  });
}

async function processConnectorSyncJob(payload: Record<string, unknown>) {
  const connectorId = String(payload.connectorId ?? '');
  if (!connectorId) {
    throw new Error('Connector not found');
  }

  return syncDocumentConnector(connectorId);
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const workerSecret = process.env.WORKER_SECRET;
  const headerSecret = request.headers.get('x-worker-secret');
  if (workerSecret && headerSecret !== workerSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Phase 5: Reset jobs stuck in 'running' for > 10 minutes (replaces pg_cron)
  await sql`
    UPDATE processing_jobs
    SET status = 'pending', started_at = NULL
    WHERE status = 'running' AND started_at < NOW() - INTERVAL '10 minutes'
  `;

  if (Date.now() >= nextAutoSyncCheckAt) {
    try {
      await enqueueDueDocumentConnectorSyncJobs(CONNECTOR_AUTO_SYNC_INTERVAL_HOURS);
    } catch (error) {
      console.error('[worker] Failed to enqueue connector auto-sync jobs:', error);
    } finally {
      nextAutoSyncCheckAt = Date.now() + AUTO_SYNC_ENQUEUE_CHECK_MS;
    }
  }

  // Claim the next pending job atomically (FOR UPDATE SKIP LOCKED)
  const jobs = await sql<ProcessingJobRecord[]>`SELECT * FROM claim_next_pending_job()`;
  const job = jobs[0];

  if (!job) {
    return NextResponse.json({ processed: false });
  }

  let result: Record<string, unknown> | null = null;
  let jobError: string | null = null;

  try {
    if (job.type === 'document_process') {
      result = await processDocumentJob(job.payload as Record<string, unknown>);
    } else if (job.type === 'quiz_generate') {
      result = await processQuizGenerateJob(job.payload as Record<string, unknown>);
    } else if (job.type === 'connector_sync') {
      result = await processConnectorSyncJob(job.payload as Record<string, unknown>);
    } else if (job.type === 'bot_thread_reply') {
      result = await processBotThreadReplyJob(job.payload as Record<string, unknown>);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
  } catch (err) {
    jobError = err instanceof Error ? err.message : 'Unknown error';
  }

  await sql`
    UPDATE processing_jobs
    SET status = ${jobError ? 'failed' : 'done'},
        result = ${result ? sql.json(result as Parameters<typeof sql.json>[0]) : null},
        error = ${jobError},
        completed_at = NOW()
    WHERE id = ${job.id}
  `;

  return NextResponse.json({ processed: true, jobId: job.id });
}
