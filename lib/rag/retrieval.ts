import 'server-only';

import { embedText } from '@/lib/rag/embeddings';
import sql from '@/lib/db';

export interface RetrievedChunk {
  id: string;
  content: string;
  document_id: string;
  document_name: string;
  similarity: number;
}

export async function retrieveRelevantChunks(projectId: string, query: string, limit = 5) {
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
