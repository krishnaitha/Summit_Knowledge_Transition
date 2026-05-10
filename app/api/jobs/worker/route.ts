import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { ChatCompletion } from 'groq-sdk/resources/chat/completions';

import { createGroqQuizCompletion } from '@/lib/groq/chat';
import { extractTextFromFile } from '@/lib/documents/parse';
import { processDocumentRecord } from '@/lib/documents/process';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { sleep } from '@/lib/utils';
import type { ProcessingJobRecord, QuizOptionKey } from '@/lib/types/database';

// ─── Quiz generation helpers (moved from /api/quiz/generate) ──────────────────

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

function buildUserPrompt(context: string, category: Category, setIndex: number, totalSets: number): string {
  const label = category === 'functional' ? 'Functional' : 'Technical';
  const topicHint = setIndex === 0
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
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
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
        question_type: String(q.question_type ?? '').toLowerCase() === 'true_false' ? 'true_false' : 'mcq',
        correct_option: String(q.correct_option).toUpperCase(),
      }));
  } catch {
    return [];
  }
}

// ─── Job processors ────────────────────────────────────────────────────────────

async function processDocumentJob(payload: Record<string, unknown>) {
  const documentId = String(payload.documentId ?? '');
  const projectId = String(payload.projectId ?? '');

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (error || !document) throw new Error('Document not found');

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(document.file_url);

  if (downloadError || !fileData) {
    throw downloadError ?? new Error('Unable to download file from storage');
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const content = await extractTextFromFile(document.file_name, buffer);
  const chunkCount = await processDocumentRecord(documentId, projectId, content);

  revalidatePath(`/admin/projects/${projectId}`);

  return { chunkCount };
}

async function processQuizGenerateJob(payload: Record<string, unknown>) {
  const projectId = String(payload.projectId ?? '');
  const category: Category = payload.category === 'technical' ? 'technical' : 'functional';
  const numSets = Math.min(5, Math.max(1, Number(payload.numSets) || 3));

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: rawChunks } = await supabase
    .from('document_chunks')
    .select('content')
    .eq('project_id', projectId)
    .limit(30);

  if (!rawChunks?.length) {
    throw new Error('No document content found. Upload and process KT documents first.');
  }

  const shuffled = shuffle(rawChunks);
  const chunkGroups = splitIntoGroups(shuffled, numSets);

  const { data: existingSets } = await supabase
    .from('quiz_sets')
    .select('set_number')
    .eq('project_id', projectId)
    .order('set_number', { ascending: false })
    .limit(1);

  const startSetNumber = ((existingSets?.[0]?.set_number as number) ?? 0) + 1;
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
      const completion = await createGroqQuizCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 2500,
      }) as ChatCompletion;

      const raw = completion?.choices?.[0]?.message?.content ?? '{}';
      questions = parseQuestions(raw);
    } catch (groqErr) {
      const msg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      console.error(`[worker] Groq error on set ${i + 1}:`, msg);
      if (i === 0) throw new Error(`AI generation failed: ${msg}`);
      continue;
    }

    if (!questions.length) continue;

    const setNumber = startSetNumber + i;
    const { data: newSet, error: setError } = await supabase
      .from('quiz_sets')
      .insert({
        project_id: projectId,
        set_name: `${categoryLabel} Set ${setNumber}`,
        set_number: setNumber,
        category,
        is_active: false,
      })
      .select('id')
      .single();

    if (setError || !newSet) continue;

    const rows = questions.map((q) => ({
      quiz_set_id: newSet.id,
      question_text: q.question_text,
      question_type: q.question_type,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c ?? '',
      option_d: q.option_d ?? '',
      correct_option: q.correct_option as QuizOptionKey,
      explanation: q.explanation || null,
      marks: q.question_type === 'true_false' ? 1 : q.marks === 3 ? 3 : 2,
    }));

    const { error: qError } = await supabase.from('quiz_questions').insert(rows);
    if (!qError) {
      createdSets++;
      createdQuestions += rows.length;
    }
  }

  if (createdSets === 0) {
    throw new Error('No sets were created. The AI may have returned unusable output — please try again.');
  }

  revalidatePath(`/admin/projects/${projectId}/quiz`);

  return { createdSets, createdQuestions };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Authenticate: if x-worker-secret header is present, it must match.
  // Absence of the header is allowed (fire-and-forget calls from the app itself).
  const workerSecret = process.env.WORKER_SECRET;
  const headerSecret = request.headers.get('x-worker-secret');
  if (workerSecret && headerSecret !== workerSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  // Atomically claim the next pending job (uses FOR UPDATE SKIP LOCKED internally)
  const { data: jobs, error: rpcError } = await supabase.rpc('claim_next_pending_job');
  if (rpcError) {
    console.error('[worker route] claim_next_pending_job RPC error:', rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }
  const job = (jobs as ProcessingJobRecord[] | null)?.[0];

  if (!job) {
    return NextResponse.json({ processed: false });
  }

  let result: Record<string, unknown> | null = null;
  let jobError: string | null = null;

  try {
    if (job.type === 'document_process') {
      result = await processDocumentJob(job.payload);
    } else if (job.type === 'quiz_generate') {
      result = await processQuizGenerateJob(job.payload);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
  } catch (err) {
    jobError = err instanceof Error ? err.message : 'Unknown error';
  }

  // Mark job as done or failed
  await supabase
    .from('processing_jobs')
    .update({
      status: jobError ? 'failed' : 'done',
      result: result ?? null,
      error: jobError,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  return NextResponse.json({ processed: true, jobId: job.id });
}
