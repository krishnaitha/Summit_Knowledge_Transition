import 'server-only';

import { embedText, getCurrentEmbeddingModelSpec } from '@/lib/rag/embeddings';
import sql from '@/lib/db';

export interface RetrievedChunk {
  id: string;
  content: string;
  document_id: string;
  document_name: string;
  similarity: number;
}

interface EmbeddingConsistencyRow {
  total_chunks: number;
  mismatched_chunks: number;
  sample_model_id: string | null;
  sample_model_revision: string | null;
}

interface ProjectDocumentRow {
  id: string;
}

async function purgeAndScheduleProjectReindex(projectId: string, reason: string) {
  const projectUuid = projectId;
  const projectIdText = projectId;
  const reasonText = reason;

  const documents = await sql<ProjectDocumentRow[]>`
    SELECT id
    FROM documents
    WHERE project_id = ${projectUuid}::uuid
  `;

  await sql`
    DELETE FROM document_chunks
    WHERE project_id = ${projectUuid}::uuid
  `;

  if (!documents.length) {
    return 0;
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO processing_jobs (type, payload)
    SELECT
      'document_process',
      jsonb_build_object(
        'documentId', d.id,
        'projectId', ${projectIdText}::text,
        'sourceMode', 'canonical',
        'reason', ${reasonText}::text
      )
    FROM documents d
    WHERE d.project_id = ${projectUuid}::uuid
      AND NOT EXISTS (
        SELECT 1
        FROM processing_jobs pj
        WHERE pj.type = 'document_process'
          AND pj.status IN ('pending', 'running')
          AND pj.payload->>'documentId' = d.id::text
      )
    RETURNING id
  `;

  return rows.length;
}

async function assertEmbeddingConsistency(projectId: string) {
  const embeddingSpec = getCurrentEmbeddingModelSpec();
  const expectedRevision = embeddingSpec.modelRevision ?? '';

  const rows = await sql<EmbeddingConsistencyRow[]>`
    WITH chunk_models AS (
      SELECT
        COALESCE(embedding_model_id, '') AS embedding_model_id,
        COALESCE(embedding_model_revision, '') AS embedding_model_revision
      FROM document_chunks
      WHERE project_id = ${projectId}
        AND embedding IS NOT NULL
    )
    SELECT
      COUNT(*)::int AS total_chunks,
      COUNT(*) FILTER (
        WHERE NOT (
          embedding_model_id = ${embeddingSpec.modelId}
          AND embedding_model_revision = ${expectedRevision}
        )
      )::int AS mismatched_chunks,
      (
        SELECT NULLIF(cm.embedding_model_id, '')
        FROM chunk_models cm
        WHERE NOT (
          cm.embedding_model_id = ${embeddingSpec.modelId}
          AND cm.embedding_model_revision = ${expectedRevision}
        )
        LIMIT 1
      ) AS sample_model_id,
      (
        SELECT NULLIF(cm.embedding_model_revision, '')
        FROM chunk_models cm
        WHERE NOT (
          cm.embedding_model_id = ${embeddingSpec.modelId}
          AND cm.embedding_model_revision = ${expectedRevision}
        )
        LIMIT 1
      ) AS sample_model_revision
    FROM chunk_models
  `;

  const summary = rows[0];
  if (!summary || summary.total_chunks === 0 || summary.mismatched_chunks === 0) {
    return;
  }

  const foundModel = summary.sample_model_id ?? 'unknown';
  const foundRevision = summary.sample_model_revision ?? 'none';
  const expectedModel = embeddingSpec.modelId;
  const expectedModelRevision = embeddingSpec.modelRevision ?? 'none';

  await purgeAndScheduleProjectReindex(
    projectId,
    `embedding_mismatch:${foundModel}@${foundRevision}->${expectedModel}@${expectedModelRevision}`,
  );

  throw new Error(
    `Embedding model mismatch detected for this project. Expected ${expectedModel}@${expectedModelRevision}, found ${foundModel}@${foundRevision}. Existing vectors were purged and a re-index job was queued from canonical sources.`,
  );
}

export async function retrieveRelevantChunks(projectId: string, query: string, limit = 5) {
  await assertEmbeddingConsistency(projectId);

  const embedding = await embedText(query);

  // postgres.js passes arrays as Postgres array literals; cast to vector explicitly
  const rows = await sql<RetrievedChunk[]>`
    SELECT * FROM match_document_chunks(
      ${JSON.stringify(embedding)}::vector,
      ${projectId}::uuid,
      ${limit}
    )
  `;

  return rows;
}
