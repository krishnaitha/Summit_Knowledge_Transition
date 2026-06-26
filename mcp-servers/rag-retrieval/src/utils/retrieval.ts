import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
let sql: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (sql) return sql;
  if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is required');
  sql = postgres(DATABASE_URL, { max: 5 });
  return sql;
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  document_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
}

export async function searchChunks(queryEmbedding: number[], projectId: string, topK = 5, minSimilarity = 0.3): Promise<RetrievedChunk[]> {
  const db = getDb();
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  return db<RetrievedChunk[]>`
    SELECT dc.id, dc.document_id, d.file_name AS document_name, dc.content, dc.chunk_index,
      1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.project_id = ${projectId}
      AND dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `;
}

export async function getProjectEmbeddingModel(projectId: string): Promise<{ modelId: string; revision: string } | null> {
  const db = getDb();
  const rows = await db<Array<{ embedding_model_id: string; embedding_model_revision: string }>>`
    SELECT DISTINCT embedding_model_id, embedding_model_revision FROM document_chunks WHERE project_id = ${projectId} LIMIT 1
  `;
  if (!rows.length) return null;
  return { modelId: rows[0].embedding_model_id, revision: rows[0].embedding_model_revision };
}
