'use server';

import { randomUUID } from 'crypto';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { revalidateTag } from 'next/cache';

import { requireAnyAdmin } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { createGroqChatCompletion } from '@/lib/groq/chat';
import { uploadFile } from '@/lib/storage/local';

const TRANSCRIPT_PROMPT = `You are a technical knowledge management specialist. Transform the transcript below into a comprehensive knowledge-transfer document. Always output in Markdown.

Produce exactly these sections in this order, using these exact headings:

## Executive Summary
2–3 sentences describing what this knowledge is about and why it matters.

## Background & Context
Who owns this, what system/process/domain does it relate to, and any prerequisites the reader needs.

## Key Concepts & Definitions
Bullet list of important terms, systems, acronyms, or components — each with a one-line explanation. Use **bold** for the term.

## Detailed Knowledge
The core knowledge body. Use ### sub-headings to separate distinct topics. Each sub-section must be self-contained and explain the "how" and "why", not just the "what".

## Process & Workflow
Step-by-step procedures or decision flows. Use numbered lists. If multiple processes exist, separate them with ### sub-headings. Write "N/A" if none mentioned.

## Common Issues & Solutions
Known problems, gotchas, and edge cases. Use this pattern for each:
**Issue:** describe the problem
**Solution:** describe the fix or workaround
Write "N/A" if none mentioned.

## Action Items & Next Steps
Bullet list of any tasks, pending decisions, or follow-ups explicitly mentioned. Write "N/A" if none.

## Key Takeaways
Exactly 3–5 bullet points. The most critical things someone must remember after reading this document.

RULES:
- Use ## for main sections and ### for sub-sections only
- Use **bold** for system names, API names, critical values, and key terms
- Preserve exact names from the transcript verbatim
- Do not invent or assume information not stated in the transcript
- Every sentence must add value — no filler

TRANSCRIPT:
{TRANSCRIPT}`;

// --- DOCX helpers ---

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index) }));
    runs.push(new TextRun({ text: m[1], bold: true }));
    last = regex.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

async function buildDocxBuffer(markdownContent: string, title: string): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 56 })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 480 },
    }),
  ];

  for (const raw of markdownContent.split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      continue;
    }

    if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: trimmed.slice(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }),
      );
    } else if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: trimmed.slice(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 160 },
        }),
      );
    } else if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: trimmed.slice(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
    } else if (/^[-*] /.test(trimmed)) {
      children.push(
        new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: parseInline(trimmed.slice(2)),
          spacing: { after: 80 },
        }),
      );
    } else if (/^\d+\. /.test(trimmed)) {
      children.push(
        new Paragraph({
          numbering: { reference: 'numbered-list', level: 0 },
          children: parseInline(trimmed.replace(/^\d+\. /, '')),
          spacing: { after: 80 },
        }),
      );
    } else {
      children.push(
        new Paragraph({
          children: parseInline(trimmed),
          spacing: { after: 120 },
        }),
      );
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

// --- Server actions ---

export async function generateDocumentFromTranscriptAction(formData: FormData) {
  const { profile } = await requireAnyAdmin();

  const transcript = String(formData.get('transcript') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim() || 'Generated Document';
  const format = String(formData.get('format') ?? 'markdown');

  if (!transcript) throw new Error('Please provide a transcript');
  if (transcript.length < 50) throw new Error('Transcript must be at least 50 characters');
  if (transcript.length > 50000) throw new Error('Transcript must be less than 50,000 characters');

  try {
    const completion = await createGroqChatCompletion({
      messages: [{ role: 'user', content: TRANSCRIPT_PROMPT.replace('{TRANSCRIPT}', transcript) }],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const raw = ('choices' in completion ? completion.choices[0]?.message?.content : null) || '';
    if (!raw) throw new Error('Failed to generate document — no content returned');

    // Canonical markdown — always used for preview and KB push
    const markdownContent = raw.startsWith('#') ? raw : `# ${title}\n\n${raw}`;

    let formattedContent = markdownContent;
    let contentBase64: string | undefined;
    let ext: string;

    if (format === 'text') {
      formattedContent = raw
        .replace(/^### /gm, '--- ')
        .replace(/^## /gm, '--- ')
        .replace(/^# /gm, '--- ')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '');
      formattedContent = `${title.toUpperCase()}\n${'='.repeat(title.length)}\n\n${formattedContent}`;
      ext = 'txt';
    } else if (format === 'docx') {
      const buf = await buildDocxBuffer(markdownContent, title);
      contentBase64 = buf.toString('base64');
      // formattedContent stays as markdownContent for preview and KB push
      ext = 'docx';
    } else {
      ext = 'md';
    }

    const slug = title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return {
      success: true,
      content: formattedContent, // text — for preview and KB push
      contentBase64, // set only for docx — binary download
      title,
      format,
      filename: `${slug || 'document'}.${ext}`,
      generatedBy: profile?.id,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Transcript Generation Error]', error);
    throw new Error(
      `Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export async function pushToKnowledgeBaseAction(params: {
  content: string;
  filename: string;
  projectId: string;
}) {
  const { profile } = await requireAnyAdmin();

  const { content, filename, projectId } = params;

  if (!projectId) throw new Error('Select a project first');
  if (!content) throw new Error('No content to push');

  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, projectId);
  if (!canAccess) throw new Error('You do not have access to this project');

  const ext = filename.endsWith('.md') ? 'md' : 'txt';
  const storageFileName = `${projectId}-${randomUUID()}.${ext}`;
  const storagePath = await uploadFile(storageFileName, Buffer.from(content, 'utf-8'));

  const documentId = randomUUID();
  await sql`
    INSERT INTO documents (id, project_id, file_name, file_url, file_type, uploaded_by, chunk_count)
    VALUES (
      ${documentId}, ${projectId}, ${filename},
      ${storagePath}, ${ext}, ${profile!.id}, 0
    )
  `;

  const jobs = await sql`
    INSERT INTO processing_jobs (type, payload)
    VALUES ('document_process', ${sql.json({ documentId, projectId })})
    RETURNING id
  `;
  const jobId = (jobs[0] as { id: string }).id;

  const workerUrl = `${process.env.INTERNAL_APP_URL ?? 'http://localhost:3000'}/api/jobs/worker`;
  fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': process.env.WORKER_SECRET ?? '',
    },
  }).catch(() => {});

  revalidateTag(`project-docs:${projectId}`, {});

  return { documentId, jobId };
}
