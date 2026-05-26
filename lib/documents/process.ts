import 'server-only';

import sql from '@/lib/db';
import { logActivity } from '@/lib/data';
import { redactPii } from '@/lib/documents/pii';
import { scanDocument } from '@/lib/documents/scan';
import { chunkDocumentText } from '@/lib/rag/chunking';
import { embedText, getCurrentEmbeddingModelSpec } from '@/lib/rag/embeddings';

export async function processDocumentRecord(
  documentId: string,
  projectId: string,
  content: string,
) {
  // Redact PII and scan for secrets before chunking
  const pii = redactPii(content);
  const scan = scanDocument(content, pii.count > 0);
  const cleanContent = pii.redactedText;

  const chunks = chunkDocumentText(cleanContent);
  const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.content)));
  const embeddingSpec = getCurrentEmbeddingModelSpec();

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
    SET
      chunk_count    = ${chunks.length},
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

  return chunks.length;
}
