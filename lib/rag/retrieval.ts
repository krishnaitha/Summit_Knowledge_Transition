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

  throw new Error(
    `Embedding model mismatch detected for this project. Expected ${expectedModel}@${expectedModelRevision}, found ${foundModel}@${foundRevision}. Re-ingest project documents to continue.`,
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
