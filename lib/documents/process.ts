import 'server-only';

import { createHash } from 'crypto';

import sql from '@/lib/db';
import { logActivity } from '@/lib/data';
import { redactPii } from '@/lib/documents/pii';
import { scanDocument } from '@/lib/documents/scan';
import { chunkDocumentText } from '@/lib/rag/chunking';
import { embedText, getCurrentEmbeddingModelSpec } from '@/lib/rag/embeddings';

interface CanonicalSourceRow {
  canonical_content: string;
}

function sha256(input: string) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function upsertCanonicalSource(
  documentId: string,
  projectId: string,
  canonicalContent: string,
) {
  const contentHash = sha256(canonicalContent);

  await sql`
    INSERT INTO document_canonical_sources (
      document_id,
      project_id,
      canonical_content,
      content_sha256
    )
    VALUES (
      ${documentId},
      ${projectId},
      ${canonicalContent},
      ${contentHash}
    )
    ON CONFLICT (document_id)
    DO UPDATE SET
      project_id = EXCLUDED.project_id,
      canonical_content = EXCLUDED.canonical_content,
      content_sha256 = EXCLUDED.content_sha256,
      updated_at = NOW()
  `;
}

async function getCanonicalSource(documentId: string) {
  const rows = await sql<CanonicalSourceRow[]>`
    SELECT canonical_content
    FROM document_canonical_sources
    WHERE document_id = ${documentId}
    LIMIT 1
  `;

  return rows[0]?.canonical_content ?? null;
}

async function replaceDocumentChunksFromContent(
  documentId: string,
  projectId: string,
  canonicalContent: string,
) {
  const chunks = chunkDocumentText(canonicalContent);
  const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.content)));
  const embeddingSpec = getCurrentEmbeddingModelSpec();

  await sql`DELETE FROM document_chunks WHERE document_id = ${documentId}`;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    await sql`
      INSERT INTO document_chunks (
        document_id,
        project_id,
        content,
        chunk_index,
        embedding,
        embedding_model_id,
        embedding_model_revision
      )
      VALUES (
        ${documentId},
        ${projectId},
        ${chunk.content},
        ${chunk.chunkIndex},
        ${JSON.stringify(embedding)}::vector,
        ${embeddingSpec.modelId},
        ${embeddingSpec.modelRevision}
      )
    `;
  }

  await sql`
    UPDATE documents
    SET chunk_count = ${chunks.length}
    WHERE id = ${documentId}
  `;

  return chunks.length;
}

export async function processDocumentRecord(
  documentId: string,
  projectId: string,
  content: string,
) {
  // Stage 1: build and persist canonical source content.
  const pii = redactPii(content);
  const scan = scanDocument(content, pii.count > 0);
  const cleanContent = pii.redactedText;
  await upsertCanonicalSource(documentId, projectId, cleanContent);

  await sql`
    UPDATE documents
    SET
      pii_detections = ${pii.count},
      classification = ${scan.classification},
      scan_flags     = ${scan.scanFlags}
    WHERE id = ${documentId}
  `;

  if (pii.count > 0) {
    await logActivity({
      userId: null,
      projectId,
      action: 'document_pii_detected',
      metadata: { documentId, count: pii.count, types: pii.types },
    });
  }

  // Stage 2: regenerate vectors from canonical source only.
  const canonicalSource = await getCanonicalSource(documentId);
  if (!canonicalSource) {
    throw new Error(
      'Canonical source is missing for this document. Re-upload or retry processing.',
    );
  }

  return replaceDocumentChunksFromContent(documentId, projectId, canonicalSource);
}
